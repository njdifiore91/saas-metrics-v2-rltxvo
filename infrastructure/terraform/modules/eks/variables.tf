# Terraform AWS EKS Module Variables
# Version: hashicorp/terraform ~> 1.0

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster. Must be between 1-100 characters and contain only alphanumeric characters and hyphens."
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{0,98}[a-zA-Z0-9]$", var.cluster_name))
    error_message = "Cluster name must start with a letter, end with an alphanumeric character, and contain only alphanumeric characters and hyphens."
  }
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster. Must be a valid EKS version (e.g., 1.24, 1.25, etc.)"
  default     = "1.24"
  
  validation {
    condition     = can(regex("^1\\.(2[4-9]|[3-9][0-9])$", var.cluster_version))
    error_message = "Cluster version must be 1.24 or higher."
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the EKS cluster will be deployed."
  
  validation {
    condition     = can(regex("^vpc-[a-f0-9]{8,17}$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC ID (e.g., vpc-1234567890abcdef0)."
  }
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for multi-AZ EKS deployment. Minimum of 2 subnets required for high availability."
  
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnet IDs are required for high availability."
  }

  validation {
    condition     = can([for s in var.subnet_ids : regex("^subnet-[a-f0-9]{8,17}$", s)])
    error_message = "All subnet IDs must be valid AWS subnet IDs (e.g., subnet-1234567890abcdef0)."
  }
}

variable "node_instance_types" {
  type        = list(string)
  description = "List of EC2 instance types for EKS nodes. Must be t3.large or higher for production workloads."
  default     = ["t3.large"]
  
  validation {
    condition     = can([for t in var.node_instance_types : regex("^(t3\\.(large|xlarge|2xlarge)|m5\\.|c5\\.|r5\\.).+$", t)])
    error_message = "Instance types must be t3.large or higher performance tier instances."
  }
}

variable "desired_capacity" {
  type        = number
  description = "Desired number of nodes in the EKS cluster. Must be between min and max capacity."
  default     = 2
  
  validation {
    condition     = var.desired_capacity >= 2
    error_message = "Desired capacity must be at least 2 for high availability."
  }
}

variable "max_capacity" {
  type        = number
  description = "Maximum number of nodes in the EKS cluster. Must be greater than or equal to desired capacity."
  default     = 5
  
  validation {
    condition     = var.max_capacity <= 20
    error_message = "Maximum capacity cannot exceed 20 nodes for cost control."
  }
}

variable "min_capacity" {
  type        = number
  description = "Minimum number of nodes in the EKS cluster. Must be at least 2 for high availability."
  default     = 2
  
  validation {
    condition     = var.min_capacity >= 2
    error_message = "Minimum capacity must be at least 2 for high availability."
  }
}

variable "disk_size" {
  type        = number
  description = "Disk size in GB for EKS worker nodes. Must be at least 20GB."
  default     = 50
  
  validation {
    condition     = var.disk_size >= 20
    error_message = "Disk size must be at least 20GB."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all EKS resources. Must include required tags for resource management."
  default     = {}
  
  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "ManagedBy")
    error_message = "Tags must include 'Environment' and 'ManagedBy' keys."
  }
}