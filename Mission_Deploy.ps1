# Mission Deployment Script
# Adds a new ingest mission to the Aura Command Plane

$url = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
if ($args.Count -gt 0) { $url = $args[0] }

Write-Host "Deploying Mission to http://localhost:8080/jobs..." -ForegroundColor Yellow
$payload = @{ url = $url } | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/jobs" -Method Post -Body $payload -ContentType "application/json"

Write-Host "Mission Registered. Sniper Spawning..." -ForegroundColor Green
