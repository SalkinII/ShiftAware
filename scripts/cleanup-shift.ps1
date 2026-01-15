# PowerShell script to cleanup orphaned shift via API
# Usage: .\cleanup-shift.ps1 -ShiftId "cmkfpxc04000nt67nmvucpzux" -BaseUrl "http://localhost:3000" -SessionCookie "your-session-cookie"
# 
# To get your session cookie:
# 1. Log in via browser
# 2. Open DevTools (F12) > Application > Cookies
# 3. Copy the value of the session cookie (usually named 'auth.session-token' or similar)
# 4. Pass it as -SessionCookie parameter

param(
    [Parameter(Mandatory=$true)]
    [string]$ShiftId,
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000",
    
    [Parameter(Mandatory=$false)]
    [string]$SessionCookie
)

$uri = "$BaseUrl/api/shifts/$ShiftId/cleanup"

Write-Host "Cleaning up shift: $ShiftId" -ForegroundColor Yellow
Write-Host "Endpoint: $uri" -ForegroundColor Gray

# Prepare headers
$headers = @{
    "Content-Type" = "application/json"
}

# Add session cookie if provided
if ($SessionCookie) {
    $headers["Cookie"] = "auth.session-token=$SessionCookie"
    Write-Host "Using provided session cookie" -ForegroundColor Gray
} else {
    Write-Host "⚠️  No session cookie provided - authentication may fail" -ForegroundColor Yellow
    Write-Host "   Tip: Get cookie from browser DevTools > Application > Cookies" -ForegroundColor Gray
}

try {
    $response = Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers
    
    Write-Host "`n✅ Cleanup successful!" -ForegroundColor Green
    Write-Host "Message: $($response.message)" -ForegroundColor Green
    Write-Host "`nDeleted:" -ForegroundColor Cyan
    Write-Host "  - Assignments: $($response.deleted.assignments)" -ForegroundColor Cyan
    Write-Host "  - Preferences: $($response.deleted.preferences)" -ForegroundColor Cyan
    Write-Host "  - Roles: $($response.deleted.roles)" -ForegroundColor Cyan
    
    Write-Host "`n💡 Don't forget to refresh the UI or invalidate cache!" -ForegroundColor Yellow
} catch {
    Write-Host "`n❌ Error during cleanup:" -ForegroundColor Red
    
    # Check if it's an authentication error
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  Authentication failed (401 Unauthorized)" -ForegroundColor Red
        Write-Host "`n  To fix:" -ForegroundColor Yellow
        Write-Host "  1. Log in via browser at $BaseUrl/login" -ForegroundColor Yellow
        Write-Host "  2. Open DevTools (F12) > Application > Cookies" -ForegroundColor Yellow
        Write-Host "  3. Copy the session cookie value" -ForegroundColor Yellow
        Write-Host "  4. Run: .\cleanup-shift.ps1 -ShiftId `"$ShiftId`" -SessionCookie `"<cookie-value>`"" -ForegroundColor Yellow
        Write-Host "`n  Or use browser console instead:" -ForegroundColor Cyan
        Write-Host "  fetch('/api/shifts/$ShiftId/cleanup', { method: 'DELETE' })" -ForegroundColor Cyan
    } else {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorDetails) {
            Write-Host "  Error: $($errorDetails.error)" -ForegroundColor Red
            Write-Host "  Message: $($errorDetails.message)" -ForegroundColor Red
        } else {
            Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    exit 1
}
