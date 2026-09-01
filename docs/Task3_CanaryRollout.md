# Task 3 — Canary Deployment and Automated Rollout

## Objective

Implement dynamic canary rollout capability, incremental traffic promotion (0%, 25%, 50%, 75%, 100%), real-time operational state tracking, and instant rollback mechanism.

## Canary Rollout Lifecycle

```text
  [ Initial State ] -> Canary Deployment Created (0% Traffic)
                           |
                           v
  [ Phase 1: 25% ]  -> Evaluate CPU, Memory, Latency & Error Rate
                           |
                           v
  [ Phase 2: 50% ]  -> Evaluate Health Signals
                           |
                           v
  [ Phase 3: 75% ]  -> Pre-release Validation
                           |
                           +------------------------+
                           |                        |
                       (Success)                (Failure)
                           |                        |
                           v                        v
  [ Phase 4: 100% ] -> Release Complete      [ Rollback ] -> Restore Stable Version
```

## API Endpoint Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/deployments` | Initiate a new canary release |
| POST | `/api/deployments/<id>/promote` | Increase canary traffic by +25% increments up to 100% |
| POST | `/api/deployments/<id>/rollback` | Rollback canary deployment to stable version |
| GET | `/api/rollback-history` | View historical record of deployment rollbacks |
| GET | `/api/applications/<id>/metrics` | Retrieve live CPU, memory, latency, and error metrics |

## Validation Commands

### 1. Execute PowerShell Promotion Sequence

```powershell
.\scripts\promote-canary.ps1 -Percent 25
.\scripts\promote-canary.ps1 -Percent 50
.\scripts\promote-canary.ps1 -Percent 75
.\scripts\promote-canary.ps1 -Percent 100
```

### 2. Trigger Operational Rollback

```powershell
.\scripts\rollback-canary.ps1
```

### 3. Verify Database Records

```sql
SELECT * FROM deployments ORDER BY id DESC LIMIT 5;
SELECT * FROM rollback_history ORDER BY id DESC LIMIT 5;
```

## Evidence to Capture

1. Canary rollout active at 25%, 50%, 75%, and 100% on the React Dashboard.
2. Promoting deployment response from `/api/deployments/<id>/promote`.
3. Execution of rollback helper `scripts/rollback-canary.ps1` or API response.
4. Database records in `deployments` and `rollback_history` tables.
