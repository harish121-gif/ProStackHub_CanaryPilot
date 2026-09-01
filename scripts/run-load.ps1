param(
    [string]$Url = "http://localhost:8080/api/health",
    [int]$Requests = 200,
    [int]$Concurrency = 10
)

$ErrorActionPreference = "Stop"

$jobs = @()
for ($i = 1; $i -le $Requests; $i++) {
    while ((Get-Job -State Running).Count -ge $Concurrency) {
        Start-Sleep -Milliseconds 50
    }
    $jobs += Start-Job -ScriptBlock {
        param($Target)
        try { Invoke-WebRequest -Uri $Target -UseBasicParsing -TimeoutSec 10 | Out-Null; "OK" }
        catch { "FAIL" }
    } -ArgumentList $Url
}

$jobs | Wait-Job | Out-Null
$result = $jobs | Receive-Job
$jobs | Remove-Job

$ok = ($result | Where-Object { $_ -eq "OK" }).Count
$fail = $Requests - $ok
Write-Host "Requests: $Requests | Success: $ok | Failed: $fail"
