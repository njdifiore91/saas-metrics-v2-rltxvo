# Project name for production environment
project_name = "startup-metrics-platform-prod"

# Primary AWS region for production deployment
aws_region = "us-east-1"

# Production VPC CIDR block
vpc_cidr = "10.0.0.0/16"

# Production EKS node instance types for high performance
eks_node_instance_types = [
  "t3.large",  # Web tier instances
  "t3.xlarge" # Application tier instances
]

# Production EKS cluster capacity settings
eks_desired_capacity = 3  # Baseline node count for normal load
eks_max_capacity     = 6  # Maximum nodes for peak load handling
eks_min_capacity     = 2  # Minimum nodes for high availability

# Production RDS instance configuration
db_instance_class        = "db.r5.xlarge"  # High performance database instance
db_backup_retention_days = 30              # 30-day backup retention for DR compliance

# Production Redis cluster configuration
cache_node_type       = "cache.r5.large"  # High performance cache instances
redis_num_cache_nodes = 3                 # Triple node Redis cluster for HA

# Production S3 storage configuration
storage_bucket_prefix = "startup-metrics-prod"