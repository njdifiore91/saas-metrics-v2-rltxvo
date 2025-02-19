# Output definitions for the S3 storage module
# AWS Provider Version: ~> 4.0

output "bucket_id" {
  description = "The unique identifier of the reports storage S3 bucket used for resource referencing and tracking"
  value       = aws_s3_bucket.reports_storage.id
}

output "bucket_arn" {
  description = "The ARN of the reports storage S3 bucket required for IAM policy configuration and cross-service access management"
  value       = aws_s3_bucket.reports_storage.arn
}

output "bucket_name" {
  description = "The name of the reports storage S3 bucket used for resource identification and direct bucket access"
  value       = aws_s3_bucket.reports_storage.bucket
}