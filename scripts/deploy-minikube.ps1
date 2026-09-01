$ErrorActionPreference = "Stop"

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mysql-secret.yaml
kubectl apply -f k8s/db-init-configmap.yaml
kubectl apply -f k8s/mysql-pvc.yaml
kubectl apply -f k8s/mysql.yaml
kubectl apply -f k8s/backend-stable.yaml
kubectl apply -f k8s/backend-canary.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/backend-hpa.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/gateway.yaml

Write-Host "Waiting for database and application pods..."
kubectl rollout status deployment/canarypilot-db -n canarypilot --timeout=180s
kubectl rollout status deployment/canarypilot-backend-stable -n canarypilot --timeout=180s
kubectl rollout status deployment/canarypilot-backend-canary -n canarypilot --timeout=180s
kubectl rollout status deployment/canarypilot-frontend -n canarypilot --timeout=180s
kubectl rollout status deployment/canarypilot-gateway -n canarypilot --timeout=180s

Write-Host "CanaryPilot deployed."
minikube ip
Write-Host "Open: http://$(minikube ip):30080"
