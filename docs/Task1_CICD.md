# Task 1 — CI/CD Pipeline

## Objective

Automate linting, tests, Docker image creation and registry publishing whenever code is pushed to GitHub.

## Pipeline

```text
Git Push
  -> GitHub Actions
  -> Frontend lint
  -> Backend tests
  -> Docker build
  -> Docker Hub push
```

## GitHub secrets

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Evidence to capture

1. GitHub Actions successful run.
2. Lint step.
3. Test step.
4. Docker build step.
5. Docker Hub repository with SHA tag and latest tag.
6. README build badge if added by the intern.
7. Manual rollback workflow run.
