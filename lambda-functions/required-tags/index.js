const AWS = require("aws-sdk");
const configService = new AWS.ConfigService();
const sts = new AWS.STS();
const iam = new AWS.IAM();
const s3 = new AWS.S3();
const ec2 = new AWS.EC2();
const rds = new AWS.RDS();

const Tags = [
  {
    Key: "CostCenterValue",
    Value: "900124-984"
  },
  {
    Key: "Workload",
    Value: "ACME.com wordpress"
  },
  {
    Key: "Owner",
    Value: "Brad Pitt"
  }
];

exports.handler = async event => {
  console.log("EVENT\n" + JSON.stringify(event, null, 2));
  const resourceId = event.Records.map(getRecordIdsFromSnsMessage)[0];

  // get list of non compliant resources under this rule
  const resources = await getComplianceDetails();

  // grab info from this event, pluck out the specific resource ID details (type)
  const resource = resources.filter(
    r =>
      r.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceId ===
      resourceId
  )[0];
  // add tags to this resource type
  const accountId = await getAwsAccountNumber();
  const arn = getArnFromResourceId(
    resourceId,
    resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceType,
    accountId
  );
  const tagResult = await addTags(arn, Tags);
  console.log(tagResult);

  // build and send email
  const debugInfo = getPrintInfo(arn, Tags, resource, tagResult);
  await sendEmail(debugInfo, resource);
  console.log("Emailing information: ", debugInfo);
  const response = {
    statusCode: 200,
    body: debugInfo
  };
  return response;
};

async function addTags(arn, Tags) {
  const result = "Required tags added to " + arn;
  if (arn.indexOf("s3") > -1) {
    await addS3Tags(arn, Tags);
  } else if (arn.indexOf("ec2") > -1) {
    await addEc2Tags(arn, Tags);
  } else if (arn.indexOf("rds") > -1) {
    await addRdsTags(arn, Tags);
  } else {
    result = "Auto tag implementation for ARN " + arn + " not implemented.";
  }
  return result;
}

async function addEc2Tags(arn, Tags) {
  const resource = arn.split(":")[5];
  const params = {
    Resources: [resource],
    Tags
  };
  return ec2.createTags(params).promise();
}

async function addRdsTags(arn, Tags) {
  const resource = arn;
  const params = {
    ResourceName: resource,
    Tags
  };
  return rds.addTagsToResource(params).promise();
}

async function addS3Tags(arn, Tags) {
  const Bucket = arn.split(":")[5];
  const result = await s3.getBucketTagging({ Bucket }).promise();
  const existingTags = result.TagSet;
  const TagSet = existingTags.concat(Tags);
  const params = {
    Bucket,
    Tagging: {
      TagSet
    }
  };
  return s3.putBucketTagging(params).promise();
}

async function getComplianceDetails() {
  var params = {
    ConfigRuleName: "required-tags",
    ComplianceTypes: ["NON_COMPLIANT"],
    Limit: 100
  };
  const promise = await configService
    .getComplianceDetailsByConfigRule(params)
    .promise();
  return promise.EvaluationResults;
}

function getArnFromResourceId(resourceId, resourceType, accountId) {
  //arn:partition:service:region:account-id:resource-id
  // arn:aws:s3:::test2-publics3bucketpublics3bucketarc319353cadee-e01oko9wi55b
  // arn:aws:s3:::test2-publics3bucketpublics3bucketarc319353cadee-e01oko9wi55b
  let region, service;
  let resourceTypeAbbreviation = ":";
  if (
    resourceType === "AWS::S3::Bucket" ||
    resourceType.indexOf("AWS::IAM") > -1
  ) {
    region = "";
  } else {
    region = process.env.AWS_REGION;
  }
  if (resourceType.indexOf("AWS::RDS::") > -1) {
    const subType = resourceType.split("::")[2];
    if (subType === "DBSubnetGroup") resourceTypeAbbreviation += "subgrp:";
    if (subType === "DBSecurityGroup") resourceTypeAbbreviation += "secgrp:";
    if (subType === "DBCluster") resourceTypeAbbreviation += "cluster:";
  }

  if (resourceType === "AWS::S3::Bucket") {
    accountId = "";
  }

  service = resourceType.split("::")[1].toLowerCase();

  let str = `arn:aws:${service}:${region}:${accountId}${resourceTypeAbbreviation}${resourceId}`;

  console.log("Assembled ARN: ", str);
  return str;
}

function getPrintInfo(arn, tags, resource, result) {
  return `You're getting this notification because resources in your account are missing required tags.

Auto Remediation Result:\t ${result}

Rule:\t ${
    resource.EvaluationResultIdentifier.EvaluationResultQualifier.ConfigRuleName
  }
Resource Type:\t ${
    resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceType
  }
Arn:\t ${arn}
Tags:\t ${JSON.stringify(tags)}
    `;
}

async function sendEmail(text, resource) {
  var params = {
    Subject:
      "Resource missing required tags (" +
      resource.EvaluationResultIdentifier.EvaluationResultQualifier
        .ResourceType +
      ")", // process.env.EMAIL_SUBJECT,
    Message: text,
    TopicArn: "arn:aws:sns:eu-central-1:104970586768:email" // process.env.NOTIFICATION_TOPIC_ARN
  };

  // Create promise and SNS service object
  const publishTextPromise = new AWS.SNS({ apiVersion: "2010-03-31" })
    .publish(params)
    .promise();
  return publishTextPromise;
}

async function getAwsAccountNumber() {
  const data = await sts.getCallerIdentity({}).promise();
  console.log("Account information: ", data);
  return data.Account;
}

function getRecordIdsFromSnsMessage(record) {
  return record.Sns.Message;
}
