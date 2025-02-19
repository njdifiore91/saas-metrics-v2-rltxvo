# Output values for the EKS module
# Provider version: hashicorp/aws ~> 4.0

output "cluster_id" {
  description = "The unique identifier of the EKS cluster"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate authority data for cluster authentication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "ID of the security group controlling network access to the EKS cluster"
  value       = aws_security_group.eks_cluster.id
}

output "node_groups" {
  description = "Map of node group configurations including scaling settings and instance details"
  value = {
    name               = aws_eks_node_group.main.node_group_name
    arn                = aws_eks_node_group.main.arn
    status             = aws_eks_node_group.main.status
    desired_capacity   = aws_eks_node_group.main.scaling_config[0].desired_size
    max_capacity       = aws_eks_node_group.main.scaling_config[0].max_size
    min_capacity       = aws_eks_node_group.main.scaling_config[0].min_size
    instance_types     = aws_eks_node_group.main.instance_types
    disk_size          = aws_eks_node_group.main.disk_size
    subnet_ids         = aws_eks_node_group.main.subnet_ids
    remote_access_key  = aws_eks_node_group.main.remote_access[0].ec2_ssh_key
  }
}

output "cluster_oidc_issuer_url" {
  description = "The OpenID Connect issuer URL for the cluster"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "cluster_version" {
  description = "The Kubernetes version running on the cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_iam_role_arn" {
  description = "The Amazon Resource Name (ARN) of the IAM role used by the cluster"
  value       = aws_eks_cluster.main.role_arn
}

output "cluster_status" {
  description = "Current status of the EKS cluster"
  value       = aws_eks_cluster.main.status
}

output "cluster_platform_version" {
  description = "Platform version of the cluster"
  value       = aws_eks_cluster.main.platform_version
}

output "cluster_vpc_config" {
  description = "VPC configuration details for the cluster"
  value = {
    vpc_id             = aws_eks_cluster.main.vpc_config[0].vpc_id
    subnet_ids         = aws_eks_cluster.main.vpc_config[0].subnet_ids
    security_group_ids = aws_eks_cluster.main.vpc_config[0].security_group_ids
  }
}