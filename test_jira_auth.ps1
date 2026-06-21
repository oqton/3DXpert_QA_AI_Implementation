# Jira Authentication & Access Test

param(
  [string]$Email,
  [string]$ApiToken
)

$base = "https://oqton.atlassian.net"
$metaToSave = $null
$BSTR = [IntPtr]::Zero

if ([string]::IsNullOrWhiteSpace($Email)) {
  $Email = Read-Host "Enter Jira email"
}

if ([string]::IsNullOrWhiteSpace($ApiToken)) {
  # In some VS Code terminal setups, SecureString prompt may capture only one character.
  $plainToken = Read-Host "Enter Jira API token (full paste; input visible)"
} else {
  $plainToken = $ApiToken
}

$plainToken = $plainToken.Trim()
Write-Host "Token received length: $($plainToken.Length)" -ForegroundColor DarkGray
if ($plainToken.Length -lt 20) {
  Write-Host "[WARN] Token looks too short. Verify copy/paste or generate a new Atlassian API token." -ForegroundColor Yellow
}

$pair = "$Email`:$plainToken"
$basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))

$headers = @{
  Authorization = "Basic $basicAuth"
  Accept        = "application/json"
}

Write-Host "`n=== Test 1: Verify Authentication ===" -ForegroundColor Cyan
try {
  $authTest = Invoke-RestMethod -Uri "$base/rest/api/3/myself" -Headers $headers -Method Get
  Write-Host "[OK] Authentication successful" -ForegroundColor Green
  Write-Host "  User: $($authTest.displayName) ($($authTest.emailAddress))" -ForegroundColor Gray
} catch {
  Write-Host "[FAIL] Authentication failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
  exit 1
}

Write-Host "`n=== Test 2: Check Project RND3DX Access ===" -ForegroundColor Cyan
try {
  $project = Invoke-RestMethod -Uri "$base/rest/api/3/project/RND3DX" -Headers $headers -Method Get
  Write-Host "[OK] Project access successful" -ForegroundColor Green
  Write-Host "  Project: $($project.name) ($($project.key))" -ForegroundColor Gray
} catch {
  Write-Host "[FAIL] Project access failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "`n=== Test 3: Get Create Metadata ===" -ForegroundColor Cyan
try {
  $url = "$base/rest/api/3/issue/createmeta?projectKeys=RND3DX&expand=projects.issuetypes.fields"
  $meta = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
  $metaToSave = $meta
  
  if ($meta.projects -and $meta.projects.Count -gt 0) {
    Write-Host "[OK] Metadata retrieved" -ForegroundColor Green
    $issueTypes = $meta.projects[0].issuetypes
    Write-Host "  Issue Types found: $($issueTypes.Count)" -ForegroundColor Gray
    foreach ($type in $issueTypes) {
      Write-Host "    - $($type.name)" -ForegroundColor Gray
    }
  } else {
    Write-Host "[FAIL] No metadata returned" -ForegroundColor Red
  }
} catch {
  Write-Host "[FAIL] Metadata request failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "`n=== Test 4: Attempt Alternative Metadata Call ===" -ForegroundColor Cyan
try {
  $url = "$base/rest/api/3/issue/createmeta"
  $altMeta = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
  if (-not $metaToSave) {
    $metaToSave = $altMeta
  }
  
  Write-Host "[OK] Alternative call successful" -ForegroundColor Green
  if ($altMeta.projects) {
    $rnd3dx = $altMeta.projects | Where-Object { $_.key -eq "RND3DX" }
    if ($rnd3dx) {
      Write-Host "  RND3DX found in response" -ForegroundColor Gray
      $bugType = $rnd3dx.issuetypes | Where-Object { $_.name -eq "Bug" }
      if ($bugType) {
        Write-Host "  Bug issue type found with $($bugType.fields.Count) fields" -ForegroundColor Gray
      }
    }
  }
} catch {
  Write-Host "[FAIL] Alternative call failed" -ForegroundColor Red
  Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "`n=== Saving Full Response ===" -ForegroundColor Cyan
if ($metaToSave) {
  $metaToSave | ConvertTo-Json -Depth 100 | Out-File -FilePath "jira_test_response.json" -Encoding utf8
  Write-Host "[OK] Saved to: jira_test_response.json" -ForegroundColor Green
} else {
  Write-Host "[FAIL] Nothing to save: metadata was not retrieved" -ForegroundColor Red
}

# Clear secure-string buffer from memory as best effort.
if ($BSTR -ne [IntPtr]::Zero) {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}
