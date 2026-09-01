$ErrorActionPreference = "Stop"

Write-Host "Rolling back CanaryPilot to stable workload..."
kubectl scale deployment/canarypilot-backend-canary -n canarypilot --replicas=0
kubectl scale deployment/canarypilot-backend-stable -n canarypilot --replicas=3

kubectl get deployments -n canarypilot
Write-Host "Canary workload scaled to 0; stable workload restored to 3 replicas."
