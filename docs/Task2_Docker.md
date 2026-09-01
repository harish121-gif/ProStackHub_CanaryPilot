# Task 2 — Dockerized Multi-Container Application

## Services

- React frontend
- Flask backend
- MySQL database
- Nginx gateway

## Required DevOps elements

- Service-specific Dockerfiles
- Docker Compose
- Environment variables
- Health checks
- Persistent MySQL volume
- Shared Docker network

## Validation

```powershell
docker compose up --build -d
docker compose ps
```

Then verify:

- `http://localhost:8085`
- `http://localhost:8085/api/health`
- `http://localhost:8085/api/db-test`

Restart the containers and confirm MySQL data remains because the data is stored in `mysql_data`.
