# CanaryPilot

[![CanaryPilot CI/CD Workflow](https://github.com/harish121-gif/ProStackHub_CanaryPilot/actions/workflows/ci.yml/badge.svg)](https://github.com/harish121-gif/ProStackHub_CanaryPilot/actions/workflows/ci.yml)

## Smart Canary Deployment and Application Monitoring Platform

CanaryPilot is a portfolio-ready DevOps platform that demonstrates controlled software releases, application health visibility, automated CI/CD, containerization, and Kubernetes deployment.

### Core concept

A new application version is released to a small portion of traffic first. The release is observed through health and performance signals. The deployment can then be promoted gradually or rolled back to the stable version.

## Technology stack

- Frontend: React + Vite
- Backend: Flask REST API
- Database: MySQL 8.4
- Reverse proxy: Nginx
- CI/CD: GitHub Actions
- Containers: Docker / Docker Compose
- Registry: Docker Hub
- Orchestration: Kubernetes + Minikube
- Packaging: Helm
- Monitoring: Prometheus + Grafana

## Repository structure

```text
CanaryPilot/
├── backend/                 # Flask API, DB connector, tests, Dockerfile
├── frontend/                # React dashboard, Vite, Dockerfile
├── database/                # MySQL initialization
├── nginx/                   # Docker Compose gateway
├── k8s/                     # Kubernetes manifests (stable, canary, HPA, PV)
├── helm/canarypilot/        # Helm chart
├── monitoring/              # kube-prometheus-stack values + ServiceMonitor
├── scripts/                 # Windows PowerShell helper scripts
├── docs/                    # Internship documentation (Task 1 to Task 4)
├── .github/workflows/       # CI/CD + manual rollback workflows
├── docker-compose.yml
└── README.md
```

## Features

- Application registration API
- Deployment tracking
- Canary rollout state from 0% to 100% in 25% increments
- Promote and rollback APIs
- Rollback history
- Health and readiness endpoints
- Prometheus `/metrics` endpoint
- React operations dashboard
- Dockerized 3-tier stack
- MySQL persistent volume
- GitHub Actions lint/test/build/push pipeline
- Kubernetes stable + canary workloads
- HPA resource configuration
- Helm packaging
- Prometheus/Grafana installation guide

## Local development

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python app.py
```

Create `backend/.env` and set your local MySQL password.

Backend URLs:

- `http://localhost:5000/`
- `http://localhost:5000/api/health`
- `http://localhost:5000/api/db-test`
- `http://localhost:5000/metrics`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Task 1: CI/CD

Create a GitHub repository and add these secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Push to `main`/`master`. The workflow:

1. Lints the React frontend.
2. Runs Flask tests.
3. Builds backend and frontend images.
4. Pushes SHA and `latest` tags to Docker Hub.

The manual rollback workflow can pull a previous SHA tag. For a local operational rollback, use the PowerShell rollback helper in `scripts/rollback-compose.ps1` or restore a previous Helm image tag in Kubernetes.

## Task 2: Docker Compose

At project root:

```powershell
copy .env.example .env
docker compose up --build -d
docker compose ps
```

Open:

- Application: `http://localhost:8085`
- Health: `http://localhost:8085/api/health`
- DB test: `http://localhost:8085/api/db-test`

Stop:

```powershell
docker compose down
```

Remove database volume for a clean reset:

```powershell
docker compose down -v
```

## Task 3: Canary Rollout & Management

Canary releases allow testing new application versions with a fraction of user traffic before full rollout.

Promote canary traffic (+25% steps):

```powershell
POST http://localhost:8080/api/deployments/<id>/promote
```

Rollback canary traffic to stable version:

```powershell
POST http://localhost:8080/api/deployments/<id>/rollback
```

PowerShell automation:

```powershell
.\scripts\promote-canary.ps1 -Percent 25
.\scripts\rollback-canary.ps1
```

## Task 4: Kubernetes

Prerequisites:

- Docker Desktop
- Minikube
- kubectl
- Helm

Build images inside Minikube:

```powershell
.\scripts\build-minikube.ps1
```

Deploy:

```powershell
.\scripts\deploy-minikube.ps1
```

Open:

```text
http://<minikube-ip>:30080
```

Install monitoring:

```powershell
.\scripts\install-monitoring.ps1
```

Monitoring:

- Grafana: `http://<minikube-ip>:30030`
- Prometheus: `http://<minikube-ip>:30090`
- Grafana username: `admin`
- Grafana password: `admin123`

> Change demo credentials before using the project anywhere beyond local internship work.

### Helm deployment

```powershell
helm upgrade --install canarypilot ./helm/canarypilot --namespace canarypilot --create-namespace
```

### Canary rollout demonstration

```powershell
.\scripts\promote-canary.ps1 -Percent 25
.\scripts\promote-canary.ps1 -Percent 50
.\scripts\promote-canary.ps1 -Percent 75
.\scripts\promote-canary.ps1 -Percent 100
```

The scripts adjust stable/canary workload capacity for a local demonstration. The dashboard's Promote/Rollback controls manage the deployment state in MySQL; Kubernetes workload promotion is demonstrated separately with the deployment scripts.

Rollback:

```powershell
.\scripts\rollback-canary.ps1
```

## Useful API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness / health |
| GET | `/api/ready` | Readiness with DB check |
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Create application |
| GET | `/api/deployments` | List deployments |
| POST | `/api/deployments` | Create deployment |
| POST | `/api/deployments/<id>/promote` | Increase canary state |
| POST | `/api/deployments/<id>/rollback` | Roll back deployment |
| GET | `/api/applications/<id>/metrics` | Application metrics |
| GET | `/api/incidents` | Incidents |
| GET | `/api/rollback-history` | Rollback history |
| GET | `/metrics` | Prometheus metrics |

## Suggested 30-day internship execution plan

### Week 1 — Application foundation
Build and verify React dashboard, Flask APIs and MySQL schema.

### Week 2 — Containerization
Dockerfiles, Compose, Nginx, health checks, environment configuration and persistent storage.

### Week 3 — CI/CD + Kubernetes
GitHub Actions, Docker Hub, Minikube, Helm, deployments, services and HPA.

### Week 4 — Monitoring + evidence
Prometheus, Grafana, canary/rollback demonstrations, load test screenshots, documentation, README cleanup and walkthrough recording.

## Evidence checklist

Capture:

- GitHub repository
- Successful GitHub Actions run
- Docker Hub image tags
- `docker compose ps`
- Application running at `localhost:8080`
- Kubernetes pods/services/deployments
- Helm release
- HPA output
- Grafana dashboard
- Prometheus targets
- Canary promotion
- Rollback result
- Final architecture diagram

## Security notes

- Do not commit real passwords or tokens.
- Keep `backend/.env` and root `.env` out of Git.
- Replace the demo Docker Hub and Grafana credentials before any public deployment.
- Use GitHub Actions secrets for registry credentials.
