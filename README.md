# Security vulnerability identification and remediation
In this session, learn how to monitor, alert, and remediate security events in your AWS environments. You use an AWS CloudFormation template to introduce a number of issues into accounts, including unencrypted and public S3 buckets, open security groups, and AWS Identity and Access Management (IAM) accounts without MFA enabled. You then practice monitoring, alerting, and automatic remediation for these issues using AWS Config, AWS Security Hub, and AWS Lambda.

# NOTICE
Materials in this lab **CREATE** security vulnerabilities for **DEMONSTRATION PURPOSES** within the account they're deployed in.  Please **DO NOT** deploy these materials within an AWS account with sensitive workloads, customer data, or anywhere near anything that could represent a production environment.

# Background
* Review [./ARC319LabGuide.pdf](./ARC319LabGuide.pdf) for instructions/lab walkthrough
* The vulnerabilities can be found in [this yaml](modules/threeTierWebApp/threeTierWebApp-vulnerability.yml)
* The config rules that remediates the environment can be found in [Config.yaml](./Config.yaml)