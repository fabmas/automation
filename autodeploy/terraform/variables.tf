variable "subscription_id" {
  type        = string
  description = "Azure Subscription ID"
  default     = "9af59c0f-7661-48ec-ac0d-fc61688f01ea"
}

variable "tenant_id" {
  type        = string
  description = "Azure Tenant ID (domain o GUID)"
  default     = "MngEnvMCAP655724.onmicrosoft.com"
}

variable "location" {
  type        = string
  description = "Azure region (deve combaciare con RG/VNet esistenti)"
  default     = "westeurope"
}

variable "resource_group_name" {
  type        = string
  description = "RG target delle VM applicative"
  default     = "RG-AutoDeploy"
}

variable "network_resource_group_name" {
  type        = string
  description = "RG che contiene la VNet/Subnet esistenti (se diverso dal RG target)"
  default     = "RG-Automation"
}

variable "vnet_name" {
  type        = string
  description = "Virtual Network name"
  default     = "adVNET"
}

variable "subnet_name" {
  type        = string
  description = "Subnet name"
  default     = "adSubnet"
}

variable "vm_name" {
  type        = string
  description = "Nome Azure VM (resource name)"
  default     = "winproto01"
}

variable "computer_name" {
  type        = string
  description = "Hostname Windows (max 15 char, no underscore). Se vuoto, usa vm_name."
  default     = "WINPROTO01"
}

variable "vm_size" {
  type        = string
  description = "SKU VM"
  default     = "Standard_D2s_v5"
}

variable "admin_username" {
  type        = string
  description = "Local admin username per bootstrap/WinRM (NON domain join)"
  default     = "localadmin"
}

variable "admin_password_secret_name" {
  type        = string
  description = "Nome del secret su Key Vault con la password del local admin della VM (es. winproto01-localadmin)"
  default     = "winproto01-localadmin"
}

variable "key_vault_name" {
  type        = string
  description = "Key Vault esistente in RG-Automation"
  default     = "fabmas-kv1"
}

variable "key_vault_resource_group_name" {
  type        = string
  description = "Resource Group del Key Vault"
  default     = "RG-Automation"
}

variable "auto01_private_ip" {
  type        = string
  description = "IP privato di auto01 (control plane) autorizzato a WinRM"
  default     = "10.0.0.5"
}

variable "tags" {
  type        = map(string)
  description = "Tag comuni (CAF / governance)"
  default = {
    workload   = "autodeploy"
    managedBy  = "terraform"
    prototype  = "true"
  }
}
