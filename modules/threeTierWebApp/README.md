# Three Tier Web App Security Vulnerability and Remediation

# NOTICE
Materials in this lab **CREATE** security vulnerabilities for **DEMONSTRATION PURPOSES** within the account they're deployed in.  Please **DO NOT** deploy these materials within an AWS account with sensitive workloads, customer data, or anywhere near anything that could represent a production environment.

## Scenario
This module includes a `threeTierWebApp-vulnerability.yml` which includes a number of vulnerabilities that could occur when putting together a common three tier web application architecture.  These include:

* Public S3 bucket
* Open Ec2 Security Groups
* Open Application load balancer
* HTTP only traffic on application load balancer
* Unencrypted storage (S3 buckets, databases)

## Architecture Diagram
TODO

## Instructions
1. Deploy `threeTierWebApp-solution.yml`
2. Review and understand the architecture diagram to understand vulnerabilities you're introducing
3. Deploy `threeTierWebApp-vulnerability.yml`
4. Review the automated remediation actions that took place
5. Review and understand the secure architecture diagram to understand best practices and how the AWS tools leveraged in `threeTierWebApp-solution.yml` can help

# Gaps
## Non technical Gaps
1. Architecture Digrams

## Technical Gaps
1. Fix S3 IAM
2. Double check EC2 remediation as "stop instance" - is there a better way
3. RDS - same as ec2, only stop instance currently
4. Overly permissive IAM policies - triggers if it has `*` access, lambda function required.
5. Unrestricted ssh - just eliminates public access but doesn't let you whitelist , lambda function required
6. required tags - no auto remediation, probably lambda or something else required
7. 3 tier - RDS - vulnerability definition missing
8. 3 tier - IAM - overly permissive roles

# stretch goals
1. Automated patching