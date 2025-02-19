# Output definitions for Redis ElastiCache module
# These outputs expose essential Redis cluster information for other modules

output "redis_cluster_id" {
  description = "The ID of the Redis ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_primary_endpoint" {
  description = "The primary endpoint address for Redis write operations"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "The reader endpoint address for Redis read operations"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "The port number used by the Redis cluster"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_security_group_id" {
  description = "The ID of the security group controlling Redis cluster access"
  value       = aws_security_group.redis.id
}

output "redis_connection_string" {
  description = "Formatted connection string for Redis cluster access"
  value       = format(
    "redis://%s:%d",
    aws_elasticache_replication_group.redis.primary_endpoint_address,
    aws_elasticache_replication_group.redis.port
  )
}