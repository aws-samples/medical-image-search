import React, { Component } from 'react';
import API, { graphqlOperation } from '@aws-amplify/api';
import { S3Image } from 'aws-amplify-react'
import {Grid, Header, Input, List, Segment} from 'semantic-ui-react'
import { 
  VictoryBar, 
  VictoryChart, 
  VictoryAxis, 
  VictoryTheme, 
  VictoryLabel, 
  VictoryContainer} from 'victory';
import { Link } from "react-router-dom";

const GetReport = `
  query($reportid: String) {
    getReport(ReportId: $reportid) {
      ReportId
      Impression
      Findings
      PositiveSigns
      NegativeSigns
      PositiveDiagnoses
      NegativeDiagnoses
      PositiveSymptoms
      NegativeSymptoms
      PositiveICD10CMs
      NegativeICD10CMs
    }
  }
`

const GetImage = `
  query($imageid: String) {
    getImage(ImageId: $imageid) {
      ReportId
      ImageId
      Bucket
      Key
      BodyPartExamined
      Modality
      ViewPosition
    }
  }
`

const SimilarImages = `
  query($imageid: String) {
    getSimilarImages(ImageId: $imageid, k:30) {
      ImageId
      ReportId
      Bucket
      Key
      ViewPosition
    }
  }
`


const SimilarPositiveICD10CMs = `
  query($reportids: String) {
    getPositiveICD10CMsbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarNegativeICD10CMs = `
  query($reportids: String) {
    getNegativeICD10CMsbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarPositiveSigns = `
  query($reportids: String) {
    getPositiveSignsbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarNegativeSigns = `
  query($reportids: String) {
    getNegativeSignsbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarPositiveDiagnoses = `
  query($reportids: String) {
    getPositiveDiagnosesbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarNegativeDiagnoses = `
  query($reportids: String) {
    getNegativeDiagnosesbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarPositiveSymptoms = `
  query($reportids: String) {
    getPositiveSymptomsbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

const SimilarNegativeSymptoms = `
  query($reportids: String) {
    getNegativeSymptomsbyReports(input: $reportids) {
      key
      doc_count
    }
  }
`

function shortenLabel(name) {
  switch(name) {
    case 'Pneumothorax, unspecified':
      return 'Pneumothorax';
    case 'Pleural effusion, not elsewhere classified':
      return 'Pleural effusion';
    case 'Lobar pneumonia, unspecified organism':
      return 'Lobar pneumonia';
    case 'Pulmonary heart disease, unspecified':
      return 'Pulmonary heart disease';
    case 'Pneumonia, unspecified organism':
      return 'Pneumonia';
    case 'Other nonspecific abnormal finding of lung field':
      return 'nonspecific abnormal findings';
    case 'Abnormal findings on diagnostic imaging of other parts of musculoskeletal system':
      return 'Abnormal findings musculoskeletal system';
    case 'Disorder of bone, unspecified':
      return 'Disorder of bone';
    case 'Edema, unspecified':
      return 'Edema';
    case 'Interstitial pulmonary disease, unspecified':
      return 'Interstitial pulmonary disease';
    case 'Central corneal opacity, left eye':
      return 'Central corneal opacity';
    case 'Atherosclerotic heart disease of native coronary artery without angina pectoris':
      return 'Atherosclerotic heart disease';
    default:
      return name;
  }
}

class Image extends Component { 
  constructor(props) {
    super(props);
    this.state = {
      loading: false, 
      report: {
        PositiveSigns: [],
        NegativeSigns: [],
        PositiveDiagnoses: [],
        NegativeDiagnoses: [],
        PositiveSymptoms: [],
        NegativeSymptoms: [],
      }, 
      image: {},
      similarImages : [],
      positiveICD10s: [],
      negativeICD10s: [],
      positiveSigns: [],
      negativeSigns: [],
      positiveDiagnoses: [],
      negativeDiagnosis: [],
      positiveSymptoms: [],
      negativeSymptoms: []
    };
  }

  async componentDidMount() {
    this.setState({ loading: true })
    const { match: { params } } = this.props;
    const imageid = params.imageid;
    try {
      var apiData = await API.graphql(graphqlOperation(GetImage, { imageid }));
      const { data: { getImage } } = apiData;
      const image = getImage;
      this.setState({ image, loading: false });

      const reportid = image.ReportId;
      console.log(reportid)
      apiData = await API.graphql(graphqlOperation(GetReport, { reportid }));
      const { data: { getReport } } = apiData;
      const report = getReport;
      this.setState({ report, loading: false });

      apiData = await API.graphql(graphqlOperation(SimilarImages, { imageid }));
      const { data: { getSimilarImages } } = apiData;
      const similarImages = getSimilarImages;
      this.setState({ similarImages, loading: false });

      // console.log(this.state);
    } catch (err) {
      console.log('error fetching data: ', err)
    }
  }
  
  render() {
    const { report, image, similarImages,
      positiveSigns, negativeSigns,
      positiveDiagnoses, negativeDiagnosis,
      positiveSymptoms, negativeSymptoms,
      positiveICD10s, negativeICD10s, loading } = this.state;
    var neighborImages=[];
    // if (image.ViewPosition == 'AP') {
    //   neighborImages = APneighbors
    // } else if (image.ViewPosition == 'PA') {
    //   neighborImages = PAneighbors
    // } else {
    //   neighborImages = LLneighbors
    // }
    return (
      <div>
        { 
          !loading && (
            <Grid container devided='vertically'>
              <Grid.Row columns={2} padded>
                <Grid.Column>
                  <Header>Impression: {report.Impression}</Header>
                  <S3Image imgKey={image.Key} level='public' theme={{ photoImg: { height: '320px', width: '320px' } }}/>
                  <div><b>BodyPartExamined:</b> {image.BodyPartExamined}</div>
                  <div><b>Modality: </b> {image.Modality}</div>
                  <div><b>ViewPosition: </b> {image.ViewPosition}</div>
                </Grid.Column>
                <Grid.Column>
                  <div><b>Findings:</b> {report.Findings}</div>
                  <Segment.Group horizontal>
                      <Segment padded color='yellow'>
                        <Header>Signs</Header>
                          {report.PositiveSigns.map(
                            (posSigns, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'green' }}>{posSigns}</p>
                              </List.Item>
                          )}
                          {report.NegativeSigns.map(
                            (negSigns, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'red' }}>{negSigns}</p>
                              </List.Item>
                          )}
                      </Segment>
                      <Segment padded color='yellow'>
                        <Header>Diagnoses</Header>
                          {report.PositiveDiagnoses.map(
                            (positiveDiag, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'green' }}>{positiveDiag}</p>
                              </List.Item>
                          )}
                          {report.NegativeDiagnoses.map(
                            (negativeDiag, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'red' }}>{negativeDiag}</p>
                              </List.Item>
                          )}
                      </Segment>
                      <Segment padded color='yellow'>
                        <Header>Symptoms</Header>
                          {report.PositiveSymptoms.map(
                            (positiveSymp, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'green' }}>{positiveSymp}</p>
                              </List.Item>
                          )}
                          {report.NegativeSymptoms.map(
                            (negativeSymp, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'red' }}>{negativeSymp}</p>
                              </List.Item>
                          )}
                      </Segment>
                  </Segment.Group>
                </Grid.Column>
              </Grid.Row>
              <Grid.Row>
                <List horizontal>
                  {
                    similarImages.map(
                      (image,i) => 
                        <List.Item key={i}> 
                          <Link to={`/Image/${image.ImageId}`}>
                            <S3Image key={i} imgKey={image.Key} level='public' theme={{ photoImg: { height: '200px', width: '200px' } }}/>
                          </Link>
                        </List.Item>
                      )
                    }
                  </List>
              </Grid.Row>
            </Grid> 
          )
        }
      </div>
    );
  }
};

export default Image;

