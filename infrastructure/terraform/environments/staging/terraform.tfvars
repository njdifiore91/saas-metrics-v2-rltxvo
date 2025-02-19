# Project and environment configuration
project_name = "startup-metrics-staging"
aws_region   = "us-west-2"
vpc_cidr     = "10.1.0.0/16"
environment  = "staging"
multi_az     = true

# EKS cluster configuration
cluster_name     = "startup-metrics-staging-eks"
cluster_version  = "1.24"
eks_node_instance_types = ["t3.large"]
eks_desired_capacity    = 2
eks_max_capacity       = 4
eks_min_capacity       = 1
disk_size              = 50

# RDS configuration
db_instance_class        = "db.r5.large"
db_backup_retention_days = 7
allocated_storage        = 100

# Redis configuration
cache_node_type      = "cache.t3.medium"
redis_num_cache_nodes = 2

# Storage configuration
storage_bucket_prefix = "startup-metrics-staging"

# Resource tagging
tags = {
  Environment = "staging"
  Project     = "startup-metrics"
  ManagedBy   = "terraform"
}