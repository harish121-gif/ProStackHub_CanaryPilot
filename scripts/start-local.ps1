$ErrorActionPreference = "Stop"

Write-Host "Starting CanaryPilot with Docker Compose..."
docker compose up --build -d

docker compose ps

Write-Host "CanaryPilot: http://localhost:8080"
Write-Host "Backend health: http://localhost:8080/api/health"
