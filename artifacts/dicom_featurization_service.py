import argparse
from collections import OrderedDict
import os, sys
import time
import json
import torch
import torch.nn as nn
from skimage import transform
from torchvision import transforms, models
from PIL import Image
import png
import numpy as np
import pydicom
import boto3
from elasticsearch import Elasticsearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class PyTorchImageFeaturization():
    """
    PyTorchImageFeaturization service class. This service takes a DICOM  
    image and returns the feature vector for that image.
    """
    def __init__(self):
        self.checkpoint_file_path = None
        self.model = None
        self.dicom = None
        self.device = "cpu"
        self.initialized = False
        if 'access_key' in os.environ:
            self.access_key = os.environ['access_key']
        else:
            self.access_key = None
        if 'secret_key' in os.environ:
            self.secret_key = os.environ['secret_key']
        else:
            self.secret_key = None
        if 'aws_region' in os.environ:
            self.aws_region = os.environ['aws_region']
        else:
            self.aws_region = None
        if 'es_index' in os.environ:
            self.es_index = os.environ['es_index']
        else:
            self.es_index = None 


    def initialize(self, context):
        # Load the model and mapping file to perform infernece.
        properties = context.system_properties
        model_dir = properties.get("model_dir")

        # Read model file
        model_file_path = os.path.join(model_dir, "model.pth")
        if not os.path.isfile(model_file_path):
            raise RuntimeError("Missing model.pth file.")   
        model = torch.load(model_file_path) 
        model = model.to(self.device)
        model.eval()
        self.model = model
        self.initialized = True

    def preprocess(self, data):
        ## Scales, crops, and normalizes a DICOM image for a PyTorch model, returns an Numpy array
        img_trsfm = transforms.Compose([
            transforms.ToPILImage(),
            # convert to PIL image. PIL does not support multi-channel floating point data, workaround is to transform first then expand to 3 channel
            transforms.Resize([516, 516], interpolation=2),  # resize and crop to [512x512]
            transforms.RandomCrop(512),
            transforms.ToTensor(),
            transforms.Lambda(lambda x: x.repeat(3, 1, 1)),
            # classifier is fine-tuned on pretrained imagenet using mimic-jpeg images [HxWx3]
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        for k, v in data[0].items():
            logger.info('received data in post request: {0}: {1}'.format(k, v.decode()))
        ## download dicom from s3
        bucket = data[0].get("dicombucket").decode()
        key = data[0].get("dicomkey").decode()
        if self.access_key is not None and self.secret_key is not None and self.aws_region is not None:
            s3_client = boto3.client(
                's3',
                region_name=self.aws_region,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key
            )
            ddb_client = boto3.client(
                'dynamodb',
                region_name=self.aws_region,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key
            )
        else:
            my_session = boto3.session.Session()
            s3_client = my_session.client('s3')
            ddb_client = my_session.client('dynamodb')

        s3_client.download_file(bucket, key, key)
        dicom = pydicom.dcmread(key)
        os.remove(key)
        if dicom.get_item('ViewPosition') and len(dicom.data_element('ViewPosition').value)>0:
            dicom_array = dicom.pixel_array.astype(float)
            ## convert dicom to png thumbnail
            dicom_array_scaled = (np.maximum(dicom_array,0) / dicom_array.max()) * 255.0
            dicom_array_scaled = np.uint8(dicom_array_scaled)
            out_png = key.replace('.dcm', '.full.png')
            with open(out_png, 'wb') as out_png_file:
                w = png.Writer(dicom_array.shape[1], dicom_array.shape[0], greyscale=True)
                w.write(out_png_file, dicom_array_scaled)
            pilimage = Image.open(out_png)
            os.remove(out_png)  
            newsize = (int(pilimage.size[0]/10), int(pilimage.size[1]/10)) ## thumbnail is 1/10 in size
            pilimage = pilimage.resize(newsize) 
            thumbnail_png = key.replace('.dcm', '.png')
            pilimage.save(thumbnail_png)
            ## upload png thumbnail to s3
            pngbucket = data[0].get("pngbucket").decode()
            prefix = data[0].get("prefix").decode()
            s3_thumbnail_png = prefix + '/' + thumbnail_png
            try:
                s3_client.head_object(Bucket=pngbucket, Key=s3_thumbnail_png)
            except:
                try:
                    s3_client.upload_file(thumbnail_png, pngbucket, s3_thumbnail_png)
                    os.remove(thumbnail_png)
                except ClientError as e:
                    print('upload thumbnail png error: {}'.format(e))
            
            ## dicom metadata to be saved in dynamodb
            metadata_dict = {"ImageId": {"S": key.replace('.dcm', '')}}
            metadata_dict["ViewPosition"] = {"S": dicom.data_element('ViewPosition').value}
            metadata_dict["Bucket"] = {"S": pngbucket}
            metadata_dict["Key"] = {"S": thumbnail_png}
            metadata_dict["ReportId"] = {"S": 's'+dicom.data_element('StudyID').value}
            metadata_dict["Modality"] = {"S": dicom.data_element('Modality').value}
            metadata_dict["BodyPartExamined"] = {"S": dicom.data_element('BodyPartExamined').value}

            ddb_table = data[0].get("ddb_table").decode()
            response = ddb_client.put_item(
                TableName=ddb_table,
                Item=metadata_dict
            )
            logger.info('Dynamodb create item status: {}'.format(response['ResponseMetadata']['HTTPStatusCode']))

            ## transform dicom arrary for pytorch model featurization
            X = np.asarray(dicom_array, np.float32) / (2**dicom.BitsStored-1)
            image = img_trsfm(X).unsqueeze(0)
            es_endpoint = data[0].get("es_endpoint").decode()
            return { 'id': key.split('.')[0], 'image': image, 'ViewPosition': dicom.data_element('ViewPosition').value, 'ES': es_endpoint }
        else:
            return None


    def inference(self, img):
       # image featurization
       with torch.no_grad():
           output = self.model(img)
       
       return output.numpy()[0]

    def postprocess(self, imageid, viewposition, vectorarray, esendpoint):
        # index feature vector
        if self.access_key is not None and self.secret_key is not None:   
            my_session = boto3.session.Session(
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key
            )
        else:
            my_session = boto3.session.Session()
        
        credentials = my_session.get_credentials()
        awsauth = AWS4Auth(
            credentials.access_key, 
            credentials.secret_key, 
            self.aws_region, 
            'es', 
            session_token=credentials.token
        )
        if self.es_index is not None:
            es = Elasticsearch(
                hosts = [{'host': esendpoint, 'port': 443}],
                http_auth = awsauth,
                use_ssl = True,
                verify_certs = True,
                connection_class = RequestsHttpConnection
            )
            # Creating the Elasticsearch index if not exists
            if es.indices.exists(index=self.es_index):
                logging.info('##### ES index {} already exists. #######'.format(self.es_index))
            else:
                knn_index = {
                    "settings": {
                        "index.knn": True
                    },
                    "mappings": {
                        "properties": {
                            "feature_vector": {
                                "type": "knn_vector",
                                "dimension": 1024
                            }
                        }
                    }
                }
                es.indices.create(
                    index=self.es_index, 
                    body=knn_index,
                    ignore=400
                )
                
            response = es.index(
                index=self.es_index,
                id=imageid,
                body={
                    "feature_vector": vectorarray, 
                    "viewPosition": viewposition
                }
            )
            return response
        else:
            return 'Failed to index KNN: No ES endpoint or index'


    def handle(self, data, context):
        if not self.initialized:
            self.initialize(context)
        if data is None:
            return None

        try:
            preprocess_start = time.time()
            imageinfo = self.preprocess(data)
            if imageinfo:
                inference_start = time.time()
                vectorarray = self.inference(imageinfo['image'])
                postprocess_start = time.time()
                res = self.postprocess(imageinfo['id'], imageinfo['ViewPosition'], vectorarray, imageinfo['ES'])
                logging.info('create ES index response: {}'.format(res))
                end_time = time.time()

                metrics = context.metrics
                metrics.add_time("PreprocessTime", round((inference_start - preprocess_start) * 1000, 2))
                metrics.add_time("InferenceTime", round((postprocess_start - inference_start) * 1000, 2))
                metrics.add_time("PostprocessTime", round((end_time - postprocess_start) * 1000, 2))
                return ['Succeeded']
            else:
                return ['NO ViewPosition']
        except Exception as e:
            logging.error(e, exc_info=True)
            return [str(e)] 


