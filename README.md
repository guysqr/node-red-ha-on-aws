# Node-RED for Elastic Beanstalk, with HA and CI/CD

This project creates a Node-RED setup designed to run in a HA configuration using AWS Elastic Beanstalk and EFS. Node-RED shares state by using EFS for storage, which means all instances share the same flows, credentials etc. Configuration is passed in from the environment, so minimal config is kept within this filesystem.

## Running locally

You can install the project locally, via the usual NPM install process. You need to check you are running at least Node.js v8 - suggest you use nvm (Node version manager - https://github.com/nvm-sh/nvm) to manage Node.js versions (it'll save you time and headaches). Once you have done that, a simple `npm install` should install everything you need.

To run it, first create an Auth0 account (https://auth0.com/ they have a free dev tier) and create an application. You will need the clientID, domain and secret to continue. Create a user and update the settings.js file with this username that you will log in with.

Then create an .env file in your project root. It needs to contain as a minimum:

```
BASE_URL=http://localhost:8081
AUTH0_CLIENT_ID=<your client id>
AUTH0_DOMAIN=<you>.auth0.com
AUTH0_CLIENT_SECRET=<your client secret>
EFS_MOUNT_DIR=<local directory name>
```
EFS_MOUNT_DIR is the ENV variable that will tell Node-RED where to write its runtime files.

In the settings.js file, add the username you will log in as and give them full permissions. Also add a random key for encrypting credentials.

Then 

```
npm start
```

Should get node-red running locally under nodemon. Browse to http://localhost:8081 and you should see an Auth0 login prompt.

## Setting up the AWS infrastructure

### Creating a VPC

If you don't have a VPC set up in your account yet, the vpc-privatepublic.yaml template will create one with private and public subnets that EB can use. If you don't want to do that you can just configure the EB CF stack to use the default VPC, it'll just mean everything will be put into public subnets.

### Creating the EB stack

Before you begin, make sure the following Elastic Beanstalk IAM roles have been created in your AWS account:

```
aws-elasticbeanstalk-ec2-role
aws-elasticbeanstalk-service-role
```

There is a CloudFormation template `eb-with-efs.yaml` in the cf-templates directory, and a helper python script you can use to create a fresh version if you want to stand this up in a region other than ap-southeast-2 (Sydney). The python script will populate the EB solution stacks section with the ones available in the region your AWS CLI is configured to use (check `aws configure`, and install aws cli tools if you don't have them). 

Running

`python3 ./build-cf.py`

will write a file called `eb-with-efs-out.yaml` in the cf-templates directory. 

NB If you are using Sydney you can skip this and just use the current `eb-with-efs-out.yaml`. If you get an error when creating the stack you will need to regenerate the file though, as stacks do get updated from time to time.

The EB deployment CF template has parameters you need to set, including names for the EB application and environment. You might use 'Node-RED' for the application name and 'development' or similar for the environment name. 

### Making a deploy bucket 

Before you can use the automated deployment available via Gulp, you will also need to run the `eb-deploy-bucket.yaml` CF template to create an S3 bucket and credentials that Gulp will use to do the deploy. If you don't want to do that bit you can skip the bucket setup.

Once you have created your EB stack and EB deploy bucket, you will have the info you need to build the deploy package.

## Building the app bundle

To build the application bundle you can deploy to EB, just run

```
gulp minify
gulp build
```

This will write a zip archive to the dist folder. It will be named according to the values in your package.json, environment and a timestamp.

## Deploying the app

You can either upload the zip archive directly via the EB console, or use Gulp deploy, or set up a CI/CD pipeline of your choosing. 

If you want to use Gulp, you will need to add some entries to your `.env` file first:

```
EB_DEPLOY_APPLICATION_NAME=<your EB app name>
EB_DEPLOY_ENVIRONMENT_NAME=<your EB environment name>
EB_DEPLOY_ACCESS_KEY_ID=<access key with permissions to deploy to EB>
EB_DEPLOY_SECRET_ACCESS_KEY=<matching secret key>
EB_DEPLOY_S3_REGION=<aws region>
EB_DEPLOY_S3_BUCKET=<your deployment bucket>
```

Then, run

```
gulp deploy
```

It will automatically run build, then deploy and you will hopefully see output like:

```
$ gulp deploy
[11:03:49] Using gulpfile ~/node-red-ha-on-aws/gulpfile.js
[11:03:49] Starting 'deploy'...
[11:03:49] Running for environment: staging
[11:03:49] To run for specific environment use: /usr/local/bin/gulp -e <environment name, prod or staging>
[11:03:49] Cleaned up dist folder
[11:03:51] Created package 1.0.0-node-red-on-elastic-beanstalk-2019.7.27_11_03_49.zip under dist folder
[11:04:20] Enviroment node-red-3 transitioned from Ok(Updating) to Info(Updating)
[11:04:31] Enviroment node-red-3 transitioned from Info(Updating) to Info(Updating)
[11:04:40] Enviroment node-red-3 transitioned from Info(Updating) to Info(Updating)
[11:04:49] Enviroment node-red-3 transitioned from Info(Updating) to Info(Updating)
[11:05:00] Enviroment node-red-3 transitioned from Info(Updating) to Info(Updating)
[11:05:09] Enviroment node-red-3 transitioned from Info(Updating) to Info(Updating)
[11:05:13] Enviroment node-red-3 transitioned from Info(Updating) to Info(Ready)
[11:05:13] Finished 'deploy' after 1.4 min
```

### Using a pipeline

Alternatively you can set up the project for Continuous Deployment (CD) using `Bitbucket Pipelines`. Create a pipeline YAML file that runs the gulp task. 

## Note on making changes

Please note, as the flow file is decoupled from the source code, the deployment will only rollout changes in settings.js, package.json or .ebextensions. It will not deploy your local `flow` file.

### Installing new npm packages

You do this by installing them locally, and using the --save option to write the dependency to the package.json file. You then need to build and deploy that new package to get the new package on your deployed Node-RED instance. Don't attempt to install them via the Node-RED Manage palette, you won't have the requisite permissions on the instance and even if you could, they wouldn't be persisted between instances.

### Managing flow file changes

As mentioned above, flow files are not stored in this repo and are not deployed via this process - they are stored on the EFS volume. When an individual instance changes a flow, the filesystem watcher in nodemon (under which Node-RED runs) restarts it's NR instance to reload the flows. It's a bit of a brute-force approach to a problem that has no simple answer, unfortunately, but it works.

NB: I recommend you use Projects in Node-RED to leverage git for managing flows within your deployed Node-RED instances. I have enabled them in the settings.js file.

## Troubleshooting

To build and run locally, you need to make sure the relevant environment variables are set.
