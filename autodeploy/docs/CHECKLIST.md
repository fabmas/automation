# Checklist (DONE criteria)

1) **Prerequisiti accesso Azure (auto01)**
   - Login con identità approvata (preferibile Managed Identity se auto01 è in Azure).
   - Permessi minimi su subscription `9af59c0f-7661-48ec-ac0d-fc61688f01ea` e RG target.

2) **Prerequisiti Terraform state**
   - Storage Account `fabmastorageaccount01` con container `tfstate` privato.
   - RBAC minimo sul container (Storage Blob Data Contributor) solo al control plane.
   - Locking/consistency: backend `azurerm`.

3) **Prerequisiti Key Vault**
   - Secret per password local admin VM: es. `winproto01-localadmin`.
   - Access policy/RBAC data-plane minimo per Terraform (Get) e per Rundeck/Ansible se necessario.

4) **Terraform (Job 1)**
   - `terraform init` con backend-config.
   - `terraform validate`.
   - `terraform plan`.
   - `terraform apply`.
   - Output log Rundeck: `VM_NAME`, `VM_IP`, `computer_name`.

5) **Inventory Ansible**
   - Job 1 genera `ansible/inventory/terraform.yml` con IP privato della VM.
   - Variabili WinRM corrette (porta 5985) e credenziali bootstrap (local admin) fornite in modo sicuro.

6) **Ansible (Job 2)**
   - Configura DNS verso `10.0.0.4` con `ansible.windows.win_dns_client`.
   - Join dominio con `microsoft.ad.membership`.
   - Reboot con `ansible.windows.win_reboot`.
   - Verify membership (fail se non joined).

7) **Ripetibilità**
   - `terraform destroy` e re-run Job 1 + Job 2 senza drift.

8) **Vincoli rispettati**
   - Nessun `JsonADDomainExtension`.
   - Nessun `Custom Script Extension`.
   - Nessun domain join in Terraform.
   - Guest config solo via Ansible/PowerShell.

9) **Collocazione corretta (RG/VNet)**
   - VNet/Subnet (`adVNET`/`adSubnet`) risiedono in `RG-Automation`.
   - VM/NIC/NSG create da Terraform risiedono in `RG-AutoDeploy`.
