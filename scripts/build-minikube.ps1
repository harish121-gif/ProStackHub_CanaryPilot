$ErrorActionPreference = "Stop"

minikube start --driver=docker --cpus=4 --memory=6144

Write-Host "Using Minikube Docker environment..."
minikube -p minikube docker-env --shell powershell | Invoke-Expression

docker build -t canarypilot-backend:latest ./backend
docker build -t canarypilot-frontend:latest ./frontend

Write-Host "Images built inside Minikube:"
docker images canarypilot-backend
 docker images canarypilot-frontend
