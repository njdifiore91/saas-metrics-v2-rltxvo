# Core environment variables
variable "environment" {
  type        = string
  description = "Environment name for resource naming and tagging (e.g., production, staging)"
}

# Network configuration variables
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where RDS instances will be deployed"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block of the VPC for security group rules"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where RDS instances will be deployed"
}

# Instance configuration variables
variable "db_instance_class" {
  type        = string
  description = "RDS instance type (db.r5.xlarge recommended for production workloads)"
  default     = "db.r5.xlarge"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage size in GB for RDS instances"
  default     = 100
}

# Database authentication variables
variable "db_username" {
  type        = string
  description = "Master username for PostgreSQL database"
  sensitive   = true
}

variable "db_password" {
  type        = string
  description = "Master password for PostgreSQL database"
  sensitive   = true
}

# High availability and backup configuration
variable "multi_az" {
  type        = bool
  description = "Enable multi-AZ deployment for high availability (recommended for production)"
  default     = true
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups (minimum 7 days recommended for production)"
  default     = 7
}