#!/usr/bin/env bash

# This script shows how to build the Docker image and push it to ECR to be ready for use by SageMaker.

# The argument to this script is the image name. This will be used as the image on the local
# machine and combined with the account and region to form the repository name for ECR.
image_name=sagemaker-pytorch-inference

# Get the account number associated with the current IAM credentials
account=$(aws sts get-caller-identity --query Account --output text)

# Get the region defined in the current configuration (default to us-east-1 if none defined)
region=$(aws configure get region)
region=${region:-us-east-1}


fullname="${account}.dkr.ecr.${region}.amazonaws.com/${image_name}:latest"

# If the repository doesn't exist in ECR, create it.
aws ecr describe-repositories --repository-names "${image_name}" > /dev/null 2>&1

if [ $? -ne 0 ]
then
    aws ecr create-repository --repository-name "${image_name}" > /dev/null
fi

# Get the login command from ECR and execute it directly
$(aws ecr get-login --region ${region} --no-include-email)

# Build the docker image locally with the image name and then push it to ECR with the full name.
docker build  -t ${image_name} . --build-arg REGION=${region}
docker tag ${image_name} ${fullname}

docker push ${fullname}