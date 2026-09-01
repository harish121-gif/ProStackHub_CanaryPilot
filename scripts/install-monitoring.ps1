$ErrorActionPreference = "Stop"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install kube-prometheus-stack `
  prometheus-community/kube-prometheus-stack `
  --namespace monitoring `
  --create-namespace `
  --values monitoring/values.yaml `
  --wait `
  --timeout 10m

kubectl apply -f monitoring/servicemonitor.yaml

Write-Host "Monitoring installed."
Write-Host "Grafana: http://$(minikube ip):30030"
Write-Host "Prometheus: http://$(minikube ip):30090"
Write-Host "Grafana user: admin"
Write-Host "Grafana password: admin123"
