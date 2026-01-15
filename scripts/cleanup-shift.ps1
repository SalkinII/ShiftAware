# PowerShell script to cleanup orphaned shift via API
# Usage: .\cleanup-shift.ps1 -ShiftId "cmkfpxc04000nt67nmvucpzux" -BaseUrl "http://localhost:3000"

param(
    [Parameter(Mandatory=$true)]
    [string]$ShiftId,
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

$uri = "$BaseUrl/api/shifts/$ShiftId/cleanup"

Write-Host "Cleaning up shift: $ShiftId" -ForegroundColor Yellow
Write-Host "Endpoint: $uri" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $uri -Method Delete -ContentType "application/json"
    
    Write-Host "`n✅ Cleanup successful!" -ForegroundColor Green
    Write-Host "Message: $($response.message)" -ForegroundColor Green
    Write-Host "`nDeleted:" -ForegroundColor Cyan
    Write-Host "  - Assignments: $($response.deleted.assignments)" -ForegroundColor Cyan
    Write-Host "  - Preferences: $($response.deleted.preferences)" -ForegroundColor Cyan
    Write-Host "  - Roles: $($response.deleted.roles)" -ForegroundColor Cyan
    
    Write-Host "`n💡 Don't forget to refresh the UI or invalidate cache!" -ForegroundColor Yellow
} catch {
    Write-Host "`n❌ Error during cleanup:" -ForegroundColor Red
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorDetails) {
        Write-Host "  Error: $($errorDetails.error)" -ForegroundColor Red
        Write-Host "  Message: $($errorDetails.message)" -ForegroundColor Red
    } else {
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}
