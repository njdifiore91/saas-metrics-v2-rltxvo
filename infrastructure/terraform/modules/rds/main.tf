# Provider requirements
# hashicorp/aws ~> 4.0
# hashicorp/random ~> 3.0

# Local variables for consistent resource naming and configuration
locals {
  db_name              = "startup_metrics_${var.environment}"
  db_port              = "5432"
  db_engine            = "postgres"
  db_engine_version    = "14"
  db_parameter_family  = "postgres14"
  tags = {
    Environment  = var.environment
    Terraform    = "true"
    Service      = "database"
    Backup       = "required"
    Encryption   = "required"
    CostCenter   = "database-infrastructure"
  }
}

# DB subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "main" {
  name        = "${local.db_name}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for RDS deployment across multiple availability zones"
  tags        = local.tags
}

# Security group for RDS access control
resource "aws_security_group" "rds" {
  name        = "${local.db_name}-sg"
  description = "Enhanced security group for RDS instances with strict access controls"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = local.db_port
    to_port         = local.db_port
    protocol        = "tcp"
    cidr_blocks     = [var.vpc_cidr]
    description     = "Allow PostgreSQL access from VPC"
  }

  egress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    cidr_blocks     = ["0.0.0.0/0"]
    description     = "Allow all outbound traffic"
  }

  tags = local.tags
}

# Parameter group for optimized PostgreSQL performance
resource "aws_db_parameter_group" "main" {
  name        = "${local.db_name}-pg"
  family      = local.db_parameter_family
  description = "Optimized parameter group for PostgreSQL performance and monitoring"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4096}"
  }

  parameter {
    name  = "work_mem"
    value = "16384"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2097152"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = local.tags
}

# Primary RDS instance
resource "aws_db_instance" "primary" {
  identifier                          = local.db_name
  engine                             = local.db_engine
  engine_version                     = local.db_engine_version
  instance_class                     = var.db_instance_class
  allocated_storage                  = var.allocated_storage
  max_allocated_storage              = var.max_allocated_storage
  db_name                           = local.db_name
  username                          = var.db_username
  password                          = var.db_password
  multi_az                          = true
  backup_retention_period           = 30
  backup_window                     = "03:00-04:00"
  maintenance_window                = "Mon:04:00-Mon:05:00"
  storage_encrypted                 = true
  storage_type                      = "gp3"
  performance_insights_enabled      = true
  performance_insights_retention_period = 7
  monitoring_interval               = 60
  enabled_cloudwatch_logs_exports   = ["postgresql", "upgrade"]
  auto_minor_version_upgrade       = true
  deletion_protection              = true
  skip_final_snapshot             = false
  copy_tags_to_snapshot          = true
  parameter_group_name           = aws_db_parameter_group.main.name
  db_subnet_group_name          = aws_db_subnet_group.main.name
  vpc_security_group_ids        = [aws_security_group.rds.id]
  tags                         = local.tags
}

# Read replica for enhanced read performance
resource "aws_db_instance" "replica" {
  identifier                      = "${local.db_name}-replica"
  instance_class                 = var.db_instance_class
  replicate_source_db           = aws_db_instance.primary.id
  multi_az                      = false
  storage_encrypted             = true
  performance_insights_enabled  = true
  monitoring_interval           = 60
  auto_minor_version_upgrade   = true
  parameter_group_name         = aws_db_parameter_group.main.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  tags                       = local.tags
}