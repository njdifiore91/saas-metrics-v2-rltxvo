# Output definitions for VPC module resources
# These outputs enable other modules to reference VPC resources and attributes

output "vpc_id" {
  description = "The ID of the VPC used for resource associations and network configuration"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC used for network planning and subnet allocation"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "List of private subnet IDs across availability zones for application and database tier deployment"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs across availability zones for load balancer and NAT gateway deployment"
  value       = aws_subnet.public[*].id
}