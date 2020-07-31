## Medical Image Search

## Demo Web UI
![Demo](Figures/demo.gif=250x)

## Overview Architecture
![Architecture](Figures/architecture.jpg=250x)


## Deployment Steps

### Step 1: Deploy Amplify React Web App
![Step1](Figures/step1.jpg=100x)

Install AWS Amplify CLI:  
`npm install -g @aws-amplify/cli@4.13.2`

[Install AWS Command Line Interface](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) 

Configure AWS CLI: `aws configure --profile <Your profile name>` 

Clone the repository
`git clone https://github.com/aws-samples/medical-image-search.git`

`cd medical-image-search && amplify init`

Answer the questions like:  
- Enter a name for the project **medical-image-search**  
- Enter a name for the environment **dev**  
- Choose your default editor: **Sublime Text**  
- Choose the type of app that you're building **javascript**  
Please tell us about your project:  
- What javascript framework are you using **react**  
- Source Directory Path:  **src**  
- Distribution Directory Path: **build**  
- Build Command:  npm run-script **build**  
- Start Command: npm run-script **start**  
- Do you want to use an AWS profile? **Yes** (Select the profile name your have configured earlier.) 

After execution, a new AWS Amplify App will be created with the name provided, e.g. medical-image-search.  

Adding Cognito authentication:  
`amplify add auth`

Answer the question like:
- Do you want to use the default authentication and security configuration? **Default configuration**  
- How do you want users to be able to sign in? **Username**  
- Do you want to configure advanced settings? **No, I am done.**  


Adding storage for medical image thumbnail files:  
`amplify add storage`

Answer the questions like:
- Please select from one of the below mentioned services: **Content (Images, audio, video, etc.)**  
- Please provide a friendly name for your resource that will be used to label this category in the project: **public**  
- Please provide bucket name: **medicalimagesearchpng**  
- Who should have access: **Auth users only**  
- What kind of access do you want for Authenticated users? **read** (press space for the selected option)  
- Do you want to add a Lambda Trigger for your S3 Bucket? **No**  

Deploy the CloudFormation (CFN) template configured above for authentication and storage:  
`amplify push`


You will see the following information:  
| Category | Resource name              | Operation | Provider plugin   |
| -------- | -------------------------- | --------- | ----------------- |
| Auth     | medicalimagesearchXXXXXXXX | Create    | awscloudformation |
| Storage  | public                     | Create    | awscloudformation |
  
confirm the deployment. After deployment finished, you will see the new cognito user pool and S3 bucket created, plus two nested CFN templetes: one for auth and another for storage. 
Take a note of the followings:
- Cognito User Pool ID as the Amplify Auth backend. 
- S3 bucket name as the Amplify Storage backend. 
Both of them can be found in the Output tab of the correspending CFN nested stack deployment:  
![Nested CFN Stack Output for Authentication](Figures/CFN_output_auth.png=250x)
![Nested CFN Stack Output for Storage](Figures/CFN_output_storage.png=250x)

Copy the following in aws-exports.js file
const awsmobile = {
    "aws_appsync_graphqlEndpoint": "",
    "aws_appsync_region": "",
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS"
};




### Build PyTorch docker container for inference
We use [Multi Model Server](https://github.com/awslabs/multi-model-server) to serve the PyTorch inference algorithm. 

Please follow the guide to install `multi-model-server` command line tool. Make sure you have Java 8 SDK installed plus all of the Python libraries imported in the script, e.g. pydicom, torch, etc.
To build the Docker container, go to the container folder and run:
`docker build -t sagemaker-pytorch-inference:latest .`

or run the script:
`mimic-cxr-search/container/build_and_push.sh `

To run container interactively:
`docker run -it --entrypoint bash sagemaker-pytorch-inference:latest`


### Build the MMS archive and copy over to S3 bucket:
Once you have `multi-model-server` command line tool install, you can wrap up your model package:
`model-archiver -f --model-name dicom_featurization_service --model-path ./ --handler dicom_featurization_service:handle --export-path ./`

and upload it to a S3 bucket with public-read ACL:
`aws s3 cp ./dicom_featurization_service.mar s3://qnabot-artifacts-us-west-2/ --acl public-read --profile qnabot`

### Deploy CFN template ecsfargate.yaml for ECS inference endpoint
Once you have the following resources ready, you can deploy the ecsforgate.yaml CFN template.
- the MMS docker container uploaded in Elastic Container Registry (ECR) or DockerHub
- BYOM package in S3

Copy the value of output InferenceAPIUrl as the next deployment parameter InferenceEndpointURL

### Deploy CFN template AppSyncBackend.yaml for AppSync backend
Once you have the following resources ready, you can deploy the AppSyncBackend.yaml CFN template.
- Inference API endpoint from ecsfargate.yaml deployment as InferenceEndpointURL
- Cognito User Pool as AuthorizationUserPool
- S3 bucket as PNGBucketName

