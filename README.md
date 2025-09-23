# QA Break Room
Minimal full-stack scaffold with RBAC (admin/user), domain lock to `innovation-group`, and game score endpoints.
## Quick start
```bash
cd backend && npm i && npm run dev
# in another terminal
cd ../frontend && npm i && npm run dev
```
### Env

## Test Case Generation (Static & AI)

The app provides two modes for generating QA test cases:

1. Static template mode (instant, deterministic)
2. AI mode with optional Detailed steps (LLM-backed)

### Frontend Usage
Navigate to QA Tools > Test Case Generator.

Inputs:
- Feature / Module: short name of the functionality (required)
- User Story / Acceptance Criteria: optional multiline description used to enrich AI output
- Risk: low | medium | high (affects diversity/coverage emphasis)
- Categories: select one or more (functional, edge, negative, security, i18n, perf, accessibility)
- AI Mode: toggle to switch from static suggestions to LLM generation
- Detailed (visible only in AI Mode): when enabled, steps become an array of objects with action + expected result pairs, suitable for manual execution scripts.

Buttons:
- Generate with AI: triggers backend call
- Copy Markdown / Copy JSON: export current visible set (AI or static)

### Backend Endpoint
`POST /tools/testcases/generate` (auth required)

Request JSON body schema:
```json
{
	"feature": "Login",
	"criteria": "As a user I can authenticate with email/password",
	"risk": "medium",
	"categories": ["functional", "negative"],
	"countPerCategory": 2,
	"detailed": true
}
```
Fields:
- `feature` (string, 3-200 chars) – required
- `criteria` (string, optional)
- `risk` enum low|medium|high (default medium)
- `categories` array of enums (defaults functional, edge, negative)
- `countPerCategory` 1–6 (default 2) used as a guidance hint to the model
- `detailed` boolean (default false) toggles step format

Response (abridged):
```json
{
	"cases": [
		{
			"id": "TC-FUNC-001",
			"title": "Successful user login",
			"category": "functional",
			"steps": [
				{ "action": "Navigate to /login", "expected": "Login form displays" },
				{ "action": "Enter valid credentials", "expected": "Fields accept input" },
				{ "action": "Click Login", "expected": "User redirected to dashboard" }
			],
			"expected": "Authenticated user session established; dashboard visible",
			"rationale": "Validates primary authentication path",
			"riskAlignment": "Addresses risk of access failure"
		}
	],
	"summary": {
		"total": 4,
		"categories": { "functional": 2, "negative": 2 },
		"notes": "..."
	}
}
```
- When `detailed` = false, `steps` is an array of strings.
- When `detailed` = true, each step is `{ action, expected }`.

### How JSON Robustness Was Implemented
LLM outputs occasionally included markdown code fences (```json ... ```). To prevent parse failures we:
1. Instructed the system prompt: no fences, no commentary
2. Added multi-pass parsing:
	 - Direct JSON.parse
	 - Strip fences regex
	 - Extract largest balanced `{ ... }` block
	 - Retry with stronger instruction if still failing
3. Added variant metadata in errors (raw | stripped | extracted | failed)
4. Normalized steps depending on `detailed` flag, coercing objects or strings appropriately

### Error Responses
`502` with payload:
```json
{
	"error": "LLM returned unparseable output",
	"hint": "Model must return raw JSON...",
	"variantTried": "failed",
	"raw": "original model text"
}
```
Use the `raw` field to inspect formatting; often removing fences or stray text resolves issues.

### Extending
Potential enhancements:
- Expose `countPerCategory` in UI
- CSV export (especially for detailed mode)
- Add traceability mapping (AC -> test IDs)
- Add severity or priority fields

### Example PowerShell Call
```powershell
$body = @{
	feature = "User Login"
	criteria = "As a user I can authenticate with email/password"
	risk = "medium"
	categories = @("functional","negative")
	countPerCategory = 2
	detailed = $true
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:4000/tools/testcases/generate `
	-Headers @{Authorization="Bearer <TOKEN>"; 'Content-Type'='application/json'} `
	-Body $body
```

## Data Generation Automation (Invoke-DataGen.ps1)
The `scripts/Invoke-DataGen.ps1` script automates end-to-end data generation and submission:

1. Acquires an Azure AD access token (client_credentials)
2. Calls `POST /datagen/generate` to build a batch payload
3. Submits the payload through `POST /datagen/submit` providing the token via `manualToken`

### Parameters
- `-Environment` (envKey in backend config, e.g. `dev`, `test`, `uat`)
- `-Feed` (e.g. `solvd`)
- `-RequestType` (e.g. `Progression`, `Estimate`, `OrderUpsert`, `Supplier`, `User`)
- `-TenantId` (AAD tenant; or set `AZURE_TENANT_ID` env var)
- `-ClientId` / `-ClientSecret` (or use env vars `DATA_GEN_CLIENT_ID` / `DATA_GEN_CLIENT_SECRET` or their suffixed forms like `DATA_GEN_CLIENT_ID_TEST`)
- `-Scope` (defaults to `api://resource/.default` unless `DATA_GEN_SCOPE` provided)
- `-BaseUrl` (default `http://localhost:4000`)
- `-OutDir` (optional; saves generation & submission JSON)
- `-DryRun` (skip submit after generate)
- `-VerboseToken` (prints shortened token preview)

### Environment Variable Resolution Order
For `ClientId` / `ClientSecret` the script checks:
1. Explicit parameter
2. `DATA_GEN_CLIENT_ID_<ENV>` / `DATA_GEN_CLIENT_SECRET_<ENV>` (upper-cased env key)
3. Fallback `DATA_GEN_CLIENT_ID` / `DATA_GEN_CLIENT_SECRET`

### Example
```powershell
pwsh ./scripts/Invoke-DataGen.ps1 `
	-Environment test `
	-Feed solvd `
	-RequestType Progression `
	-TenantId 11111111-2222-3333-4444-555555555555 `
	-ClientId $env:DATA_GEN_CLIENT_ID_TEST `
	-ClientSecret $env:DATA_GEN_CLIENT_SECRET_TEST `
	-OutDir logs `
	-VerboseToken
```

### Dry Run (Generate Only)
```powershell
pwsh ./scripts/Invoke-DataGen.ps1 -Environment dev -Feed solvd -RequestType Estimate -DryRun
```

### Output Object
The script returns a PSCustomObject containing: Environment, RequestType, Feed, BatchReference, Submission (full submission response), and optional TokenPreview.

### Troubleshooting
- Token failure: confirm tenant/app details & that corporate proxy allows `login.microsoftonline.com`.
- TLS interception: Script usually succeeds even if backend Node process cannot fetch token (manual token override flow).
- 401 on submit: Ensure the resource scope matches what the backend API expects.

---


