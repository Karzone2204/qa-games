# Pipeline Status Tracking Setup

This document explains how to set up and use the Pipeline Status tracking system for monitoring Azure DevOps releases across all projects.

## 🚀 Quick Setup

### 1. Azure DevOps Configuration

First, you need to configure access to Azure DevOps:

1. **Create a Personal Access Token (PAT)**:
   - Go to: https://dev.azure.com/innovation-group/_usersSettings/tokens
   - Click "New Token"
   - Name: `QA-Games Pipeline Status`
   - Organization: `innovation-group`
   - Expiration: Set appropriate date
   - Scopes: Select **Release (Read)**
   - Click "Create" and copy the token

2. **Add environment variables** to your `.env` file:
   ```bash
   # Azure DevOps Configuration
   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/innovation-group
   AZURE_DEVOPS_PROJECT=GG
   AZURE_DEVOPS_PAT=your_personal_access_token_here
   ```

### 2. Automated Pipeline Registration

Run the setup script to automatically register all known pipelines:

```bash
# From the project root
node scripts/setupPipelines.js
```

This will:
- Authenticate with your API
- Test Azure DevOps connection
- Register all 19 pipelines automatically
- Sync initial status data

### 3. Manual Pipeline Registration (Alternative)

If you prefer to register pipelines manually:

1. Go to **Admin Panel** → **Pipelines** tab
2. Click **"Add Pipeline"**
3. Fill in the details for each pipeline:

#### Backend Services
| Project | Definition ID | Definition Name |
|---------|---------------|-----------------|
| FNOL | 79 | FNOL Service Release |
| GlobalConfig | 64 | Global Config Service Release |
| Integration | 191 | Integration Service Release |
| Opportunity | 31 | Opportunity Service Release |
| Order | 128 | Order Service Release |
| OutboundIntegration | 209 | Outbound Integration Service Release |
| OperationalOutbound | 124 | Operational Outbound Service Release |
| Party | 47 | Party Service Release |
| Search | 171 | Search Service Release |
| OrderProcessor | 250 | Order Processor Service Release |
| Estimate | 59 | Estimate Service Release |
| NRules-Financial | 229 | NRules Financial Service Release |
| NRules-Outbound | 165 | NRules Outbound Service Release |
| Guest | 115 | Guest Service Release |
| MotorProxy | 228 | Motor Proxy Service Release |

#### Frontend Services
| Project | Definition ID | Definition Name |
|---------|---------------|-----------------|
| FrontEnd-Insight | 197 | Frontend Insight Release |
| FrontEnd-Guest | 196 | Frontend Guest Release |
| FrontEnd-Config | 195 | Frontend Config Release |
| FrontEnd-Motor | 194 | Frontend Motor Release |

## 📊 Using the Pipeline Status Dashboard

### For QA Team Members

1. **Access the Dashboard**:
   - Go to **QA Tools** → **Pipeline Status** tab
   - View real-time status of all pipelines across all environments

2. **Features Available**:
   - **Environment Status Cards**: See status for dev, test, uat, staging, prod
   - **Project Filtering**: Filter by specific project
   - **Auto-refresh**: Enable automatic status updates every 30 seconds
   - **Recent Releases**: View last few releases with timestamps
   - **Direct Links**: Click to view releases in Azure DevOps

3. **Status Indicators**:
   - ✅ **Succeeded**: Deployment completed successfully
   - ❌ **Failed**: Deployment failed
   - 🔄 **In Progress**: Currently deploying
   - ⚠️ **Partially Succeeded**: Some environments succeeded
   - ⏸️ **Not Started**: Not yet started
   - ❓ **Unknown**: Status not available

### For Administrators

1. **Manage Pipelines**:
   - Go to **Admin Panel** → **Pipelines** tab
   - Add, edit, or remove pipeline configurations
   - Test Azure DevOps connection
   - Perform bulk sync operations

2. **Monitor System Health**:
   - View sync status and errors
   - Check last sync times
   - Test API connectivity

## 🔧 API Endpoints

### Public Endpoints (Read-only)
```
GET /api/pipelines/status/overview     # Overall status summary
GET /api/pipelines/status              # All pipelines
GET /api/pipelines/status/project/:project  # Project-specific pipelines
```

### Admin Endpoints (Authentication Required)
```
GET  /api/pipelines/test-connection    # Test Azure DevOps connection
POST /api/pipelines                    # Create new pipeline
PUT  /api/pipelines/:id                # Update pipeline
DELETE /api/pipelines/:id              # Delete pipeline
POST /api/pipelines/:id/sync           # Sync single pipeline
POST /api/pipelines/sync/all           # Sync all pipelines
```

## 🛠 Troubleshooting

### Common Issues

1. **"Azure DevOps connection failed"**
   - Check your Personal Access Token
   - Verify the token has "Release (Read)" permissions
   - Ensure AZURE_DEVOPS_PAT environment variable is set

2. **"Pipeline not found" errors during sync**
   - Verify the Definition ID is correct
   - Check if the release definition exists in Azure DevOps
   - Ensure you have access to the specific project

3. **Authentication errors**
   - Make sure you're logged in as an admin user
   - Check that JWT_SECRET is properly configured

4. **Status not updating**
   - Check the last sync time in the admin panel
   - Manually trigger a sync operation
   - Verify Azure DevOps API is accessible

### Debug Mode

Enable debug logging by adding to your `.env`:
```bash
AZURE_DEVOPS_DEBUG=1
```

## 🔄 Sync Behavior

### Automatic Sync
- Pipelines with `autoRefresh: true` are synced automatically
- Default interval: 15 minutes (configurable per pipeline)
- Failed syncs are retried on the next cycle

### Manual Sync
- Use "Sync" button for individual pipelines
- Use "Sync All" for bulk operations
- Sync operations update both current status and recent releases

### Data Retention
- Last 10 releases are kept per pipeline
- Historical data includes release names, timestamps, and deployment status
- Environment-specific status tracking

## 🎯 Benefits

1. **Centralized Monitoring**: View all pipeline statuses in one place
2. **Real-time Updates**: Automatic synchronization with Azure DevOps
3. **Multi-environment Tracking**: Monitor dev, test, uat, staging, and prod
4. **Historical Data**: Track release history and trends
5. **Team Collaboration**: Shared visibility for QA team
6. **Quick Access**: Direct links to Azure DevOps for detailed information

## 📈 Future Enhancements

Potential future features:
- Email notifications for failed deployments
- Integration with Slack/Teams for alerts
- Performance metrics and deployment frequency tracking
- Custom environment mappings
- Pipeline dependency visualization
- Deployment approval workflow integration

---

For questions or issues, contact the development team or check the application logs for detailed error information.