const AWS = require("aws-sdk");
const configService = new AWS.ConfigService();
const sts = new AWS.STS();
const iam = new AWS.IAM();

/**
 * @description Processes SNS notifications for Config rule violations for
 * no IAM policies that include Admin (*:*) access on any services.
 * Sends an email with violation information.
 */
exports.handler = async event => {
  console.log("EVENT\n" + JSON.stringify(event, null, 2));
  const resourceIds = event.Records.map(getRecordIdsFromSnsMessage);

  const configResults = await getDiscoveredIamResources(resourceIds);
  const policyName = getPolicyNameFromConfigResults(configResults);
  const accountId = await getAwsAccountNumber();
  const policyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;
  console.log("Getting info for policy " + policyArn);
  const policy = await getPolicy(policyArn);
  const attachedEntities = await getEntitiesAttachedToPolicy(policyArn);
  const debugInfo = getPrintInfo(policy, attachedEntities);
  // await sendEmail();

  console.log("Emailing information: ", debugInfo);
  const response = {
    statusCode: 200,
    body: debugInfo
  };
  return response;
};

async function sendEmail(info) {
  // TODO
}

function getPrintInfo(policy, attachedEntities) {
  return `
Name:\t\t ${policy.PolicyName}
PolicyId:\t\t ${policy.PolicyId}
Arn:\t\t ${policy.Arn}
Description:\t\t ${policy.Description}
CreateDate:\t\t ${policy.CreateDate}
Attached PolicyGroups(${
    attachedEntities.PolicyGroups.length
  }): ${JSON.stringify(attachedEntities.PolicyGroups.map(i => i.GroupName))}
Attached PolicyUsers(${attachedEntities.PolicyUsers.length}): ${JSON.stringify(
    attachedEntities.PolicyUsers.map(i => i.UserName)
  )}
Attached PolicyRoles(${attachedEntities.PolicyRoles.length}): ${JSON.stringify(
    attachedEntities.PolicyRoles.map(i => i.RoleName)
  )}
    `;
}

async function getPolicy(arn) {
  const params = {
    PolicyArn: arn
  };
  const data = await iam.getPolicy(params).promise();
  console.log("Policy Data\n" + JSON.stringify(data, null, 2));
  return data.Policy;
}

async function getEntitiesAttachedToPolicy(arn) {
  const params = {
    PolicyArn: arn
  };
  const data = await iam.listEntitiesForPolicy(params).promise();
  console.log("Entity Atttachment Data\n" + JSON.stringify(data, null, 2));
  return data;
}

async function getAwsAccountNumber() {
  const data = await sts.getCallerIdentity({}).promise();
  console.log("Account information: ", data);
  return data.Account;
}

function getPolicyNameFromConfigResults(results) {
  return results.resourceIdentifiers[0].resourceName;
}

/**
 * 
 * @returns {
     "resourceIdentifiers": [
        {
            "resourceType": "AWS::IAM::Policy",
            "resourceId": "ABCDEFG123456",
            "resourceName": "policyName"
        }
    ]
 }
 * */
async function getDiscoveredIamResources(resourceIds) {
  const params = {
    resourceType: "AWS::IAM::Policy",
    includeDeletedResources: false,
    resourceIds: resourceIds
  };
  console.log("Requesting these resource Ids from Config: ", resourceIds);
  return await configService.listDiscoveredResources(params).promise();
}

function getRecordIdsFromSnsMessage(record) {
  return record.Sns.Message;
}
