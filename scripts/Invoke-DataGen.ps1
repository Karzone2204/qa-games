<#
.SYNOPSIS
Automates token acquisition, data generation, and submission for the QA Data Generator.

.DESCRIPTION
Fetches an Azure AD access token via client_credentials, calls /datagen/generate to get a payload,
then submits it to /datagen/submit providing the token as manualToken override. Supports piping
or returning structured objects. Requires PowerShell 7+ and either environment variables or
parameters for the AAD app credentials.

.PARAMETER Environment
Logical environment key matching backend ENVIRONMENTS (e.g. dev, test, uat).

.PARAMETER Feed
Feed key supported by backend (e.g. solvd).

.PARAMETER RequestType
Request type implemented in backend (e.g. Progression, Estimate, OrderUpsert, Supplier, User).

.PARAMETER TenantId
Azure AD tenant (GUID or domain). If omitted, tries $env:AZURE_TENANT_ID.

.PARAMETER ClientId
AAD application (client) id. Falls back to $env:DATA_GEN_CLIENT_ID_<ENV> then DATA_GEN_CLIENT_ID.

.PARAMETER ClientSecret
AAD application client secret. Falls back to $env:DATA_GEN_CLIENT_SECRET_<ENV> then DATA_GEN_CLIENT_SECRET.

.PARAMETER Scope
Space separated resource scopes (defaults to 'api://resource/.default' or env var override DATA_GEN_SCOPE).

.PARAMETER BaseUrl
Base URL of backend (default http://localhost:4000).

.PARAMETER OutDir
Optional directory to persist generated payload and submission response for auditing.

.PARAMETER DryRun
Generate only; do not submit.

.PARAMETER VerboseToken
Show first/last characters of token for troubleshooting.

.EXAMPLE
./Invoke-DataGen.ps1 -Environment test -Feed solvd -RequestType Progression -TenantId 11111111-2222-3333-4444-555555555555 -ClientId <id> -ClientSecret <secret>

.EXAMPLE
./Invoke-DataGen.ps1 -Environment dev -Feed solvd -RequestType OrderUpsert -OutDir logs -VerboseToken

.NOTES
If corporate TLS interception blocks token fetch, this script still works because it runs locally
with the system trust store. If you need to add a custom CA, set $env:SSL_CERT_FILE or use -SkipCertificateCheck (Invoke-RestMethod -SkipCertificateCheck requires PS7.4+). Adjust if necessary.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Environment,
  [Parameter(Mandatory=$true)][string]$Feed,
  [Parameter(Mandatory=$true)][string]$RequestType,
  [string]$TenantId = $env:AZURE_TENANT_ID,
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$Scope = $env:DATA_GEN_SCOPE,
  [string]$BaseUrl = 'http://localhost:4000',
  [string]$OutDir,
  [switch]$DryRun,
  [switch]$VerboseToken
)

function Resolve-EnvSpecificVar {
  param([string]$BaseName)
  $specific = "{0}_{1}" -f $BaseName, $Environment.ToUpper()
  $specificVal = [System.Environment]::GetEnvironmentVariable($specific)
  if($specificVal){ return $specificVal }
  $baseVal = [System.Environment]::GetEnvironmentVariable($BaseName)
  if($baseVal){ return $baseVal }
  return $null
}

if(-not $ClientId){ $ClientId = Resolve-EnvSpecificVar 'DATA_GEN_CLIENT_ID' }
if(-not $ClientSecret){ $ClientSecret = Resolve-EnvSpecificVar 'DATA_GEN_CLIENT_SECRET' }
if(-not $Scope){ $Scope = 'api://resource/.default' }
if(-not $TenantId){ throw 'TenantId is required (parameter or AZURE_TENANT_ID env var)' }
if(-not $ClientId){ throw 'ClientId is required (parameter or DATA_GEN_CLIENT_ID[_ENV])' }
if(-not $ClientSecret){ throw 'ClientSecret is required (parameter or DATA_GEN_CLIENT_SECRET[_ENV])' }

$tokenUrl = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"

Write-Host "[DataGen] Requesting token for app $ClientId (tenant $TenantId)" -ForegroundColor Cyan
try {
  $tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body @{
    client_id     = $ClientId
    client_secret = $ClientSecret
    scope         = $Scope
    grant_type    = 'client_credentials'
  } -ContentType 'application/x-www-form-urlencoded'
} catch {
  throw "Failed to obtain token: $($_.Exception.Message)"
}

if(-not $tokenResponse.access_token){ throw 'Token response missing access_token' }
$accessToken = $tokenResponse.access_token
if($VerboseToken){
  $short = $accessToken.Substring(0,25) + '...' + $accessToken.Substring($accessToken.Length-15)
  Write-Host "[DataGen] Token acquired length=$($accessToken.Length) preview=$short" -ForegroundColor DarkGray
}

$generateUrl = "$BaseUrl/datagen/generate"
$submitUrl   = "$BaseUrl/datagen/submit"

# 1. Generate
Write-Host "[DataGen] Generating payload: env=$Environment feed=$Feed type=$RequestType" -ForegroundColor Cyan
try {
  $genResp = Invoke-RestMethod -Method Post -Uri $generateUrl -Body (@{ envKey=$Environment; feedKey=$Feed; requestType=$RequestType } | ConvertTo-Json) -ContentType 'application/json'
} catch {
  throw "Payload generation failed: $($_.Exception.Message)"
}
if(-not $genResp.template){ throw 'Generation response missing template' }

# Optional output directory persistence
if($OutDir){
  if(-not (Test-Path $OutDir)){ New-Item -ItemType Directory -Path $OutDir | Out-Null }
  $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
  $genFile = 'gen_{0}_{1}_{2}.json' -f $Environment, $RequestType, $ts
  $genPath = Join-Path $OutDir $genFile
  $genResp.template | ConvertTo-Json -Depth 20 | Out-File -FilePath $genPath -Encoding UTF8
  Write-Host "[DataGen] Saved generated payload to $genPath" -ForegroundColor DarkGray
}

if($DryRun){
  Write-Host '[DataGen] DryRun specified - skipping submit.' -ForegroundColor Yellow
  return [pscustomobject]@{
    Environment = $Environment
    RequestType = $RequestType
    Feed        = $Feed
    Payload     = $genResp.template
    Token       = if($VerboseToken){ $accessToken } else { $null }
    Submitted   = $false
  }
}

# 2. Submit (manual token override)
Write-Host "[DataGen] Submitting payload via manualToken override" -ForegroundColor Cyan
$submitBody = @{ envKey=$Environment; payload=$genResp.template; manualToken=$accessToken } | ConvertTo-Json -Depth 30
try {
  $submitResp = Invoke-RestMethod -Method Post -Uri $submitUrl -Body $submitBody -ContentType 'application/json'
} catch {
  throw "Submission failed: $($_.Exception.Message)"
}

if($OutDir){
  $ts2 = Get-Date -Format 'yyyyMMdd_HHmmss'
  $subFile = 'submit_{0}_{1}_{2}.json' -f $Environment, $RequestType, $ts2
  $subPath = Join-Path $OutDir $subFile
  $submitResp | ConvertTo-Json -Depth 20 | Out-File -FilePath $subPath -Encoding UTF8
  Write-Host "[DataGen] Saved submission response to $subPath" -ForegroundColor DarkGray
}

Write-Host "[DataGen] Completed: status=$($submitResp.status) ok=$($submitResp.ok)" -ForegroundColor Green
return [pscustomobject]@{
  Environment = $Environment
  RequestType = $RequestType
  Feed        = $Feed
  BatchReference = $genResp.template.BatchReference
  Submission = $submitResp
  TokenPreview = if($VerboseToken){ $short } else { $null }
}
