# CanaryPilot Architecture

## Application layer

```text
Developer / DevOps Engineer
          |
          v
   React Operations UI
          |
          v
      Flask REST API
          |
          v
        MySQL
```

## Docker architecture

```text
                    Browser
                       |
                       v
                 Nginx :8080
                  /       \
                 /         \
                v           v
        React container   Flask container
                              |
                              v
                        MySQL container
                              |
                         Persistent volume
```

## CI/CD architecture

```text
Git push
   |
   v
GitHub Actions
   |
   +--> ESLint
   |
   +--> Pytest
   |
   +--> Docker build
   |
   v
Docker Hub
```

## Kubernetes architecture

```text
                   NodePort Gateway
                         |
              +----------+----------+
              |                     |
         Frontend svc          Backend svc
              |                     |
         React pods        +--------+--------+
                           |                 |
                     Stable pods       Canary pods
                       v1.x               v2.x
                           |
                           v
                         MySQL
                         PVC

Prometheus ---> /metrics
Grafana ------> Prometheus
HPA ----------> backend stable/canary workload resources
```

## Progressive delivery concept

```text
New version v2.x
       |
       v
   Small canary
       |
       v
Monitor health
       |
   +---+---+
   |       |
Healthy   Failure
   |       |
   v       v
Promote  Rollback
   |       |
   v       v
100%     Stable v1.x
```
