const AWS = require("aws-sdk");
const configService = new AWS.ConfigService();
const s3 = new AWS.S3();
const ec2 = new AWS.EC2();
const rds = new AWS.RDS();
const Tags = [
  { Key: "CostCenter", Value: process.env.CostCenter },
  { Key: "Workload", Value: process.env.Workload },
  { Key: "Owner", Value: process.env.Owner }
];
exports.handler = async event => {
  console.log("EVENT\n" + JSON.stringify(event, null, 2));
  const resourceId = event.Records.map(e => e.Sns.Message)[0];
  const resources = await getComplianceDetails();
  const resource = resources.filter(
    r =>
      r.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceId ===
      resourceId
  )[0];
  const accountId = process.env.ACCOUNT_ID;
  const arn = getArnFromResourceId(
    resourceId,
    resource.EvaluationResultIdentifier.EvaluationResultQualifier.ResourceType,
    accountId
  );
  const tagResult = await addTags(arn, Tags);
  const debugInfo = getPrintInfo(arn, Tags, resource, tagResult);
  await sendEmail(debugInfo, resource);
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
  const params = {
    Resources: [arn.split(":")[5]],
    Tags
  };
  return ec2.createTags(params).promise();
}

async function addRdsTags(arn, Tags) {
  const params = {
    ResourceName: arn,
    Tags
  };
  return rds.addTagsToResource(params).promise();
}

async function addS3Tags(Bucket, Tags) {
  const result = await s3.getBucketTagging({ Bucket }).promise();
  const TagSet = result.TagSet.concat(Tags);
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
    ConfigRuleName: process.env.CONFIG_RULE_NAME,
    ComplianceTypes: ["NON_COMPLIANT"],
    Limit: 100
  };
  const promise = await configService
    .getComplianceDetailsByConfigRule(params)
    .promise();
  return promise.EvaluationResults;
}

function getArnFromResourceId(resourceId, resourceType, accountId) {
  let region = process.env.AWS_REGION;
  let service = resourceType.split("::")[1].toLowerCase();
  let abbr = ":";
  if (
    resourceType === "AWS::S3::Bucket" ||
    resourceType.indexOf("AWS::IAM") > -1
  ) {
    region = "";
  }
  if (resourceType.indexOf("AWS::RDS::") > -1) {
    const subType = resourceType.split("::")[2];
    if (subType === "DBSubnetGroup") abbr += "subgrp:";
    if (subType === "DBSecurityGroup") abbr += "secgrp:";
    if (subType === "DBCluster") abbr += "cluster:";
  }
  if (resourceType === "AWS::S3::Bucket") {
    accountId = "";
  }
  let str = `arn:aws:${service}:${region}:${accountId}${abbr}${resourceId}`;
  console.log("Assembled ARN: ", str);
  return str;
}

function getPrintInfo(arn, tags, resource, result) {
  return `Resources in your account are missing required tags.
            
            Auto Remediation Result:\t ${result}
            Rule:\t ${
              resource.EvaluationResultIdentifier.EvaluationResultQualifier
                .ConfigRuleName
            }
            Resource Type:\t ${
              resource.EvaluationResultIdentifier.EvaluationResultQualifier
                .ResourceType
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
      ")",
    Message: text,
    TopicArn: process.env.NOTIFICATION_TOPIC_ARN
  };
  const publishTextPromise = new AWS.SNS({ apiVersion: "2010-03-31" })
    .publish(params)
    .promise();
  return publishTextPromise;
}
