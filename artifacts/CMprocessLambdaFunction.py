import json
import boto3
import os
import re
import sys
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
from urllib.parse import unquote_plus
from elasticsearch import Elasticsearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
esendpoint=os.environ['esendpoint']
esindex=os.environ['esindex']
region=os.environ['awsregion']
s3client=boto3.client('s3')
cm=boto3.client('comprehendmedical')

def lambda_handler(event, context):
    try:
        cred=boto3.Session().get_credentials()
        awsauth=AWS4Auth(cred.access_key, cred.secret_key, region, 'es', session_token=cred.token)
        es=Elasticsearch(hosts=[{'host': esendpoint}],scheme="https",port=443,http_auth=awsauth,connection_class=RequestsHttpConnection)
        logger.info('Connected to {0}'.format(esendpoint))
        if not es.indices.exists(index=esindex):
            request_body = {
                "settings" : {
                    "number_of_shards" : 3,
                    "number_of_replicas" : 1
                },
                'mappings': {
                    'properties': {
                        "ReportId": {"type": "text"},
                        "Impression": {"type": "text"},
                        "Findings": {"type": "text"},
                        "NegativeDiagnoses": {"type": "keyword"},
                        "NegativeICD10CMs": {"type": "keyword"},
                        "NegativeSigns": {"type": "keyword"},
                        "NegativeSymptoms": {"type": "keyword"},
                        "PositiveDiagnoses": {"type": "keyword"},
                        "PositiveICD10CMs": {"type": "keyword"},
                        "PositiveSigns": {"type": "keyword"},
                        "PositiveSymptoms": {"type": "keyword"}
                    }
                }
            }
            es.indices.create(index=esindex,body=request_body)

        for record in event['Records']:
            bucket=record['s3']['bucket']['name']
            key=unquote_plus(record['s3']['object']['key'])
            reportid=key[(key.find('/')+1):(key.find('.'))]
            logger.info('Process Report: {}'.format(reportid))
            content=s3client.get_object(Bucket=bucket, Key=key)['Body'].read().decode()
            fi=content.find('FINDINGS:')
            ii=content.find('IMPRESSION:')
            if ii>0:
                imp=content[(ii+11):].strip()
                if fi>0: 
                    fin=content[(fi+9):ii].strip()
                else:
                    fin=''
                ps = set()
                ns = set()
                pd = set()
                nd = set()
                py = set()
                ny = set()
                pi = set()
                ni = set()
                entities=cm.infer_icd10_cm(Text=content)['Entities']
                for i in entities:
                    txt=i['Text']
                    trts=i['Traits']
                    icd10=i['ICD10CMConcepts'][0]
                    pos=1
                    for t in trts:
                        if t['Name']=='NEGATION':
                            pos=0
                    if pos>0:
                        pi.add( icd10['Description'] )
                    else:
                        ni.add( icd10['Description'] )
                    for t in trts:
                        if t['Name']=='SIGN':
                            ps.add(txt) if pos>0 else ns.add(txt)
                        if t['Name']=='DIAGNOSIS':
                            pd.add(txt) if pos>0 else nd.add(txt)
                        if t['Name']=='SYMPTOM':
                            py.add(txt) if pos>0 else ny.add(txt)
                retval=es.index(
                    index=esindex,  
                    id=reportid,
                    body={
                        'ReportId': reportid,
                        'Impression': imp,
                        'Findings': fin,
                        'PositiveSigns': list(ps),
                        'NegativeSigns': list(ns),
                        'PositiveDiagnoses': list(pd),
                        'NegativeDiagnoses': list(nd),
                        'PositiveSymptoms': list(py),
                        'NegativeSymptoms': list(ny),
                        'PositiveICD10CMs': list(pi),
                        'NegativeICD10CMs': list(ni)
                    },
                    ignore=409
                )
                logger.info('ES index create result: {}'.format(json.dumps(retval)))

    except Exception as E:
        logger.error("Error: ",E)