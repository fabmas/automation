# AutoDeploy — Windows VM Prototype (Terraform + Ansible + Rundeck)

Obiettivo: deployment ripetibile di una VM Windows su Azure (Terraform) e join al dominio `fabmas.it` (Ansible), orchestrati da due Job Rundeck separati.

## Struttura
- `terraform/`: solo risorse Azure (VM/NIC/NSG/backend state)
- `ansible/`: solo guest config (DNS + domain join + reboot + verify)
- `rundeck/`: definizione concettuale job
- `docs/`: checklist e note di sicurezza

## Flusso (2 click)
1) Job 1: `terraform init/plan/apply` + generazione inventory.
2) Job 2: `ansible-playbook playbooks/join-domain.yml`.

## Vincoli
- Vietati: `JsonADDomainExtension`, `Custom Script Extension`, domain join in Terraform.

## Collocazione risorse (vincolante)
- `adVNET`/`adSubnet` sono in `RG-Automation`.
- Le VM deployate dalla soluzione sono in `RG-AutoDeploy` ma attestate alla subnet di `adVNET`.
