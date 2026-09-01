# Task 4 — Kubernetes Deployment and Monitoring

## Cluster

Use Minikube locally to avoid cloud billing.

## Components

- Stable backend Deployment
- Canary backend Deployment
- Backend Service
- Frontend Deployment and Service
- MySQL Deployment + PersistentVolumeClaim
- Gateway NodePort
- Helm chart
- HPA
- Prometheus/Grafana stack

## Demonstration

1. Start Minikube.
2. Build application images inside Minikube.
3. Deploy the stack.
4. Verify readiness/liveness probes.
5. Inspect pods, services and deployments.
6. Demonstrate canary workload changes.
7. Generate traffic/load.
8. Observe CPU and memory metrics.
9. Open Grafana.
10. Demonstrate rollback.

## Useful commands

```powershell
kubectl get pods -n canarypilot
kubectl get svc -n canarypilot
kubectl get deployments -n canarypilot
kubectl get hpa -n canarypilot
helm list -n canarypilot
```

## Monitoring

The backend exposes Prometheus metrics at `/metrics`. The kube-prometheus-stack installation is configured to discover the CanaryPilot ServiceMonitor in the `canarypilot` namespace.
