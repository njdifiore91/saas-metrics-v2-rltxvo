# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC where all resources are deployed"
  value       = module.vpc.vpc_id
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs used for internal resources"
  value       = module.vpc.private_subnets
  sensitive   = false
}

output "availability_zones" {
  description = "List of availability zones where resources are deployed"
  value       = module.vpc.availability_zones
  sensitive   = false
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
  sensitive   = false
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
  sensitive   = false
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# RDS Database Outputs
output "database_primary_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = module.rds.primary_endpoint
  sensitive   = true
}

output "database_replica_endpoint" {
  description = "Connection endpoint for the RDS read replica"
  value       = module.rds.replica_endpoint
  sensitive   = true
}

output "database_name" {
  description = "Name of the PostgreSQL database"
  value       = module.rds.database_name
  sensitive   = false
}

output "database_backup_retention_period" {
  description = "Number of days automated backups are retained"
  value       = module.rds.backup_retention_period
  sensitive   = false
}

# High Availability Information
output "high_availability_config" {
  description = "High availability configuration details"
  value = {
    multi_az_enabled     = true
    replica_count        = 1
    availability_zones   = length(module.vpc.availability_zones)
    backup_enabled       = true
    disaster_recovery    = "Multi-AZ with read replicas"
  }
  sensitive   = false
}

# Performance Configuration
output "performance_config" {
  description = "Infrastructure performance configuration"
  value = {
    database_instance_class = "db.r5.xlarge"
    eks_node_instance_type = "t3.large"
    max_database_connections = 1000
    eks_node_count = {
      min     = 2
      max     = 5
      desired = 2
    }
  }
  sensitive   = false
}

# Monitoring Information
output "monitoring_config" {
  description = "Infrastructure monitoring configuration"
  value = {
    cloudwatch_enabled        = true
    performance_insights_enabled = true
    enhanced_monitoring      = true
    monitoring_interval      = "60s"
    log_types = [
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler"
    ]
  }
  sensitive   = false
}