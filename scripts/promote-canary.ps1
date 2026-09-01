param(
    [ValidateSet(25,50,75,100)]
    [int]$Percent = 25
)

$ErrorActionPreference = "Stop"

switch ($Percent) {
    25 { $stable = 3; $canary = 1 }
    50 { $stable = 2; $canary = 2 }
    75 { $stable = 1; $canary = 3 }
    100 { $stable = 0; $canary = 4 }
}

Write-Host "Canary rollout: $Percent%"
kubectl scale deployment/canarypilot-backend-stable -n canarypilot --replicas=$stable
kubectl scale deployment/canarypilot-backend-canary -n canarypilot --replicas=$canary

kubectl get pods -n canarypilot -l app=canarypilot-backend -o wide
