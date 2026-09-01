param(
    [Parameter(Mandatory=$true)]
    [string]$BackendTag
)

$ErrorActionPreference = "Stop"

Write-Host "Pulling previous backend image tag: $BackendTag"
docker pull "YOUR_DOCKERHUB_USERNAME/canarypilot-backend:$BackendTag"

docker tag "YOUR_DOCKERHUB_USERNAME/canarypilot-backend:$BackendTag" canarypilot-backend:rollback

Write-Host "For a complete re-deploy, set the backend image tag in docker-compose or compose override and restart the stack."
Write-Host "Example: docker compose up -d --force-recreate backend"
