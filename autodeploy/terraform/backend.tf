terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.0"
    }
  }

  # Remote state su Storage Account esistente (RG-Automation / fabmastorageaccount01).
  # Nota: il backend non supporta variabili; passare i parametri via `terraform init -backend-config=...`.
  # Esempio (da Rundeck/CLI su auto01):
  # terraform -chdir=terraform init -input=false \
  #   -backend-config="resource_group_name=RG-Automation" \
  #   -backend-config="storage_account_name=fabmastorageaccount01" \
  #   -backend-config="container_name=tfstate" \
  #   -backend-config="key=autodeploy/windows-prototype.tfstate" \
  #   -backend-config="use_azuread_auth=true" \
  #   -backend-config="subscription_id=9af59c0f-7661-48ec-ac0d-fc61688f01ea" \
  #   -backend-config="tenant_id=MngEnvMCAP655724.onmicrosoft.com"
  backend "azurerm" {
    # Lo Storage Account usato per lo state può avere `allowSharedKeyAccess=false`.
    # Forza autenticazione Entra ID (Managed Identity / Azure CLI) invece delle access key.
    use_azuread_auth = true
  }
}
