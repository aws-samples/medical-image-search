import React, { Component } from 'react';
import './App.css';
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

import debounce from 'lodash/debounce' // 1

const SearchReports = `
  query($searchQuery: String) {
    searchReports(input: $searchQuery) {
      Impression
      Findings
      PositiveSigns
      NegativeSigns
      PositiveDiagnoses
      NegativeDiagnoses
      PositiveSymptoms
      NegativeSymptoms
      Images {
        ReportId
        ImageId
        Bucket
        Key
      }
    }
  }
`

const ListReports = `
  query {
    listReports(from:0, size:100) {
      Impression
      Findings
      PositiveSigns
      NegativeSigns
      PositiveDiagnoses
      NegativeDiagnoses
      PositiveSymptoms
      NegativeSymptoms
      Images {
        ReportId
        ImageId
        Bucket
        Key
      }
    }
  }
`

const SearchPositiveICD10CMs = `
  query($searchQuery: String) {
    getPositiveICD10CMs(input: $searchQuery) {
      key
      doc_count
    }
  }
`

const SearchNegativeICD10CMs = `
  query($searchQuery: String) {
    getNegativeICD10CMs(input: $searchQuery) {
      key
      doc_count
    }
  }
`

const ListPositiveICD10CMs = `
  query {
    getAllPositiveICD10CMs {
      key
      doc_count
    }
  }
`

const ListNegativeICD10CMs = `
  query {
    getAllNegativeICD10CMs {
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

class Search extends Component {
  state = {
    searchQuery: '',
    loading: false,
    items: []
  }
  async componentDidMount() {
    this.setState({ loading: true })
    try {
      var apiData = await API.graphql(graphqlOperation(ListReports))
      const { data: { listReports } } = apiData
      const items = listReports
      this.setState({ items, loading: false })

      apiData = await API.graphql(graphqlOperation(ListPositiveICD10CMs))
      const { data: { getAllPositiveICD10CMs } } = apiData
      const posICD10s = getAllPositiveICD10CMs.map(
            (obj, ind) => {
                return {
                    x : ind,
                    y : obj.doc_count,
                    label: shortenLabel(obj.key)
                }
            }
        );
      this.setState({ posICD10s, loading: false })

      apiData = await API.graphql(graphqlOperation(ListNegativeICD10CMs))
      const { data: { getAllNegativeICD10CMs } } = apiData
      const negICD10s = getAllNegativeICD10CMs.map(
            (obj, ind) => {
                return {
                    x : ind,
                    y : obj.doc_count,
                    label: shortenLabel(obj.key)
                }
            }
        );
      this.setState({ negICD10s, loading: false })

      // console.log(this.state)
    } catch (err) {
      console.log('error fetching data: ', err)
    }
  }
  onChange = (e) => { // 5
    const value = e.target.value
    if (value.length >0) {
      this.setState({ searchQuery: value }, () => {
        this.handleFilter(value)
      })
    }
  }
  handleFilter = debounce((val) => { // 6
    this.onSearch(val)
  }, 250)
  onSearch = async () => {
    const { searchQuery } = this.state
    // console.log('searchQuery: ', searchQuery)
    try {
      var apiData = await API.graphql(graphqlOperation(SearchReports, { searchQuery }))
      const { data: { searchReports } } = apiData
      const items = searchReports
      this.setState({ items })

      apiData = await API.graphql(graphqlOperation(SearchPositiveICD10CMs, { searchQuery }))
      const { data: { getPositiveICD10CMs } } = apiData
      const posICD10s = getPositiveICD10CMs.map(
            (obj, ind) => {
                return {
                    x : ind,
                    y : obj.doc_count,
                    label: shortenLabel(obj.key)
                }
            }
        );
      this.setState({ posICD10s })

      apiData = await API.graphql(graphqlOperation(SearchNegativeICD10CMs, { searchQuery }))
      const { data: { getNegativeICD10CMs } } = apiData
      const negICD10s = getNegativeICD10CMs.map(
            (obj, ind) => {
                return {
                    x : ind,
                    y : obj.doc_count,
                    label: shortenLabel(obj.key)
                }
            }
        );
      this.setState({ negICD10s })
    } catch (err) {
      console.log('error searching for data: ', err)
    }
  }
  render() {
    const { items, loading, negICD10s, posICD10s, searchQuery } = this.state
    return (
      <div className="App">
        { 
          !!loading && (
            <p>Searching...</p>
          )
        }
        { 
          !loading && !items.length && (
            <p>Sorry, no results.</p>
          )
        }
        <Grid container devided='vertically'>
          {
            !loading && (
              <Grid.Row columns={2} padded>
                <Grid.Column>
                  <VictoryChart theme={VictoryTheme.material}>
                    <VictoryBar  
                      horizontal
                      style={{ data: { fill: "Green" }, labels: { fontSize: 12 }}} 
                      // labelComponent={<VictoryLabel textAnchor="end" dx={0} dy={10} />}
                      data={posICD10s}/>
                    <VictoryAxis tickFormat={() => ''} />
                    <VictoryLabel x={100} y={30} text="Positive ICD10 CMs" />
                  </VictoryChart>
                </Grid.Column>
                <Grid.Column>
                  <VictoryChart theme={VictoryTheme.material}>
                    <VictoryBar 
                      horizontal 
                      style={{ data: { fill: "Red" }, labels: { fontSize: 12 } }} 
                      labelComponent={<VictoryLabel textAnchor="start" dx={0} />}
                      data={negICD10s}/>
                    <VictoryAxis tickFormat={() => ''} />
                    <VictoryLabel x={100} y={30} text="Negative ICD10 CMs" />
                  </VictoryChart>
                </Grid.Column>
              </Grid.Row>
            )
          }

          <Grid.Row columns={1} padded>
            <Grid.Column><Header size='large'>Search Terms</Header></Grid.Column>
          </Grid.Row>
          <Grid.Row columns={1} padded>
            <Grid.Column><Input
              fluid
              size='big'
              icon='search'
              onChange={this.onChange.bind(this)}
              placeholder='Search for Findings in Radiology Report'
            /></Grid.Column>
          </Grid.Row>

          { 
            !loading && items.map((item, index) => (
              <Grid.Row columns={2}>
                <Grid.Column>
                  <Header>Impression: {item.Impression}</Header>
                  <List horizontal>
                    {
                      item.Images.map(
                        (image,i) => 
                          <List.Item key={i}> 
                            <Link to={`/Image/${image.ImageId}`}>
                              <S3Image key={i} imgKey={image.Key} level='public' theme={{ photoImg: { height: '200px', width: '200px' } }}/>
                            </Link>
                          </List.Item>
                      )
                    }
                  </List>
                </Grid.Column>
                <Grid.Column>
                  <Segment.Group horizontal>
                      <Segment padded color='yellow'>
                        <Header>Signs</Header>
                          {item.PositiveSigns.map(
                            (posSigns, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'green' }}>{posSigns}</p>
                              </List.Item>
                          )}
                          {item.NegativeSigns.map(
                            (negSigns, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'red' }}>{negSigns}</p>
                              </List.Item>
                          )}
                      </Segment>
                      <Segment padded color='yellow'>
                        <Header>Diagnoses</Header>
                          {item.PositiveDiagnoses.map(
                            (positiveDiag, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'green' }}>{positiveDiag}</p>
                              </List.Item>
                          )}
                          {item.NegativeDiagnoses.map(
                            (negativeDiag, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'red' }}>{negativeDiag}</p>
                              </List.Item>
                          )}
                      </Segment>
                      <Segment padded color='yellow'>
                        <Header>Symptoms</Header>
                          {item.PositiveSymptoms.map(
                            (positiveSymp, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'green' }}>{positiveSymp}</p>
                              </List.Item>
                          )}
                          {item.NegativeSymptoms.map(
                            (negativeSymp, i) => 
                              <List.Item key={i}> 
                                <p style={{ color: 'red' }}>{negativeSymp}</p>
                              </List.Item>
                          )}
                      </Segment>
                  </Segment.Group>
                </Grid.Column>
              </Grid.Row>
            ))
          }
        </Grid>
      </div>
    );
  }
}

export default Search
