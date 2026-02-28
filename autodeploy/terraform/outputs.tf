output "vm_name" {
  value       = azurerm_windows_virtual_machine.vm.name
  description = "Nome della VM Azure"
}

output "vm_private_ip" {
  value       = azurerm_windows_virtual_machine.vm.private_ip_address
  description = "IP privato primario"
}

output "computer_name" {
  value       = azurerm_windows_virtual_machine.vm.computer_name
  description = "Hostname Windows"
}
