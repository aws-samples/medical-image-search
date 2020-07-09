## Medical Image Search

## Deployment Steps

### Deploy Amplify React Web UI

Install AWS Amplify CLI
`npm install -g @aws-amplify/cli@4.13.2`


Clone the repository
`git clone ssh://git-codecommit.us-west-2.amazonaws.com/v1/repos/mimic-cxr-search`

`cd mimic-cxr-search && amplify init`

Answer the questions like:
? Enter a name for the project medical-image-search
? Enter a name for the environment dev
? Choose your default editor: Sublime Text
? Choose the type of app that you're building javascript
Please tell us about your project
? What javascript framework are you using react
? Source Directory Path:  src
? Distribution Directory Path: build
? Build Command:  npm run-script build
? Start Command: npm run-script start
? Do you want to use an AWS profile? Yes

`amplify add auth`

Answer the question like:
 Do you want to use the default authentication and security configuration? Default configuration
 How do you want users to be able to sign in? Username
 Do you want to configure advanced settings? No, I am done.

`amplify add storage`

Answer the questions like:
? Please select from one of the below mentioned services: Content (Images, audio, video, etc.)
? Please provide a friendly name for your resource that will be used to label this category in the project: public
? Please provide bucket name: medicalimagesearchpng
? Who should have access: Auth users only
? What kind of access do you want for Authenticated users? create/update, read, delete
? Do you want to add a Lambda Trigger for your S3 Bucket? No


`amplify push`

Current Environment: dev

| Category | Resource name              | Operation | Provider plugin   |
| -------- | -------------------------- | --------- | ----------------- |
| Auth     | medicalimagesearchXXXXXXXX | Create    | awscloudformation |
? Are you sure you want to continue? Yes


Copy the following in aws-exports.js file
const awsmobile = {
    "aws_appsync_graphqlEndpoint": "",
    "aws_appsync_region": "",
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS"
};


Take a note of:
Cognito User Pool ID as the Amplify Auth backend
S3 bucket name as the Amplify Storage backend



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

