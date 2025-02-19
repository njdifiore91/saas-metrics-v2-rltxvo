# Output values for the RDS module exposing critical database connection information
# and resource identifiers for use by other modules and root configuration.

output "primary_endpoint" {
  description = "Complete connection endpoint URL for the primary PostgreSQL RDS instance (db.r5.xlarge)"
  value       = aws_db_instance.primary.endpoint
  sensitive   = false
}

output "primary_address" {
  description = "DNS hostname of the primary PostgreSQL RDS instance for custom connection string building"
  value       = aws_db_instance.primary.address
  sensitive   = false
}

output "primary_port" {
  description = "TCP port number for PostgreSQL database connections (default: 5432)"
  value       = aws_db_instance.primary.port
  sensitive   = false
}

output "replica_endpoint" {
  description = "Connection endpoint URL for the read replica RDS instance supporting high availability"
  value       = aws_db_instance.replica.endpoint
  sensitive   = false
}

output "security_group_id" {
  description = "ID of the security group controlling network access to RDS instances"
  value       = aws_security_group.rds.id
  sensitive   = false
}