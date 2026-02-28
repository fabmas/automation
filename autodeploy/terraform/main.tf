provider "azurerm" {
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id

  features {}
}

data "azurerm_resource_group" "target" {
  name = var.resource_group_name
}

data "azurerm_virtual_network" "vnet" {
  name                = var.vnet_name
  resource_group_name = var.network_resource_group_name
}

data "azurerm_subnet" "subnet" {
  name                 = var.subnet_name
  virtual_network_name = data.azurerm_virtual_network.vnet.name
  resource_group_name  = var.network_resource_group_name
}

# Segreto (local admin VM) da Key Vault esistente.
# Nota: anche se il valore arriva da Key Vault, finirà nello state Terraform (comportamento Terraform).
# Mitigazioni: state remoto cifrato, RBAC minimo, container private, access review.
data "azurerm_key_vault" "kv" {
  name                = var.key_vault_name
  resource_group_name = var.key_vault_resource_group_name
}

data "azurerm_key_vault_secret" "vm_admin_password" {
  name         = var.admin_password_secret_name
  key_vault_id = data.azurerm_key_vault.kv.id
}

resource "azurerm_network_security_group" "winrm" {
  name                = "${var.vm_name}-nsg"
  location            = data.azurerm_resource_group.target.location
  resource_group_name = data.azurerm_resource_group.target.name

  security_rule {
    name                       = "Allow-WinRM-HTTP-From-auto01"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5985"
    source_address_prefix      = "${var.auto01_private_ip}/32"
    destination_address_prefix = "*"
  }

  tags = var.tags
}

resource "azurerm_network_interface" "nic" {
  name                = "${var.vm_name}-nic"
  location            = data.azurerm_resource_group.target.location
  resource_group_name = data.azurerm_resource_group.target.name

  ip_configuration {
    name                          = "ipconfig1"
    subnet_id                     = data.azurerm_subnet.subnet.id
    private_ip_address_allocation = "Dynamic"
  }

  tags = var.tags
}

resource "azurerm_network_interface_security_group_association" "nic_nsg" {
  network_interface_id      = azurerm_network_interface.nic.id
  network_security_group_id = azurerm_network_security_group.winrm.id
}

resource "azurerm_windows_virtual_machine" "vm" {
  name                = var.vm_name
  resource_group_name = data.azurerm_resource_group.target.name
  location            = data.azurerm_resource_group.target.location
  size                = var.vm_size

  admin_username = var.admin_username
  admin_password = data.azurerm_key_vault_secret.vm_admin_password.value

  computer_name = length(trimspace(var.computer_name)) > 0 ? var.computer_name : upper(var.vm_name)

  network_interface_ids = [
    azurerm_network_interface.nic.id,
  ]

  provision_vm_agent = true

  # Bootstrap minimo per permettere ad Ansible (da auto01) di connettersi via WinRM.
  # NON fa domain join e NON applica configurazioni applicative.
  winrm_listener {
    protocol = "Http"
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
  }

  source_image_reference {
    publisher = "MicrosoftWindowsServer"
    offer     = "WindowsServer"
    sku       = "2022-datacenter-azure-edition"
    version   = "latest"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}
