/**
 * Azure DevOps Release API Service
 * Handles communication with Azure DevOps REST APIs for release pipelines
 */
class AzureDevOpsService {
  constructor(organizationUrl, projectName, personalAccessToken) {
    this.organizationUrl = organizationUrl.replace(/\/$/, ''); // Remove trailing slash
    this.projectName = projectName;
    this.pat = personalAccessToken;
    // Derive organization slug from https://dev.azure.com/{org}
    const orgMatch = this.organizationUrl.match(/https:\/\/dev\.azure\.com\/(.+)$/i);
    this.orgSlug = orgMatch ? orgMatch[1] : null;
    if (!this.orgSlug) {
      console.warn('[Azure DevOps] Unable to determine organization slug from organizationUrl.');
    }
    // Release (classic) APIs live under vsrm.dev.azure.com
    this.vsrmBase = this.orgSlug
      ? `https://vsrm.dev.azure.com/${this.orgSlug}/${this.projectName}/_apis`
      : `${this.organizationUrl}/${this.projectName}/_apis`;
    // Core/build APIs still use dev.azure.com base
    this.baseUrl = `${this.organizationUrl}/${this.projectName}/_apis`;
  }

  /**
   * Get authorization headers for Azure DevOps API
   */
  getHeaders() {
    const auth = Buffer.from(`:${this.pat}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Get all release definitions for the project
   */
  async getReleaseDefinitions() {
    try {
      const url = `${this.vsrmBase}/release/definitions?api-version=7.0`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error('Error fetching release definitions:', error);
      throw error;
    }
  }

  /**
   * Get releases for a specific definition
   */
  async getReleases(definitionId, top = 10) {
    try {
      // Use the correct API endpoint for release management
      const url = `${this.vsrmBase}/release/releases?definitionId=${definitionId}&$top=${top}&$orderBy=createdOn desc&api-version=7.0`;
      console.log(`[Azure DevOps] Fetching releases from: ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        console.error(`[Azure DevOps] API Error - URL: ${url}`);
        console.error(`[Azure DevOps] Status: ${response.status} ${response.statusText}`);
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[Azure DevOps] Error response: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}. URL: ${url}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error(`Error fetching releases for definition ${definitionId}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific release
   */
  async getRelease(releaseId) {
    try {
      const url = `${this.vsrmBase}/release/releases/${releaseId}?api-version=7.0`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching release ${releaseId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch single release definition (used for diagnosing 404s)
   */
  async getReleaseDefinition(definitionId) {
    try {
      const url = `${this.vsrmBase}/release/definitions/${definitionId}?api-version=7.0`;
      console.log(`[Azure DevOps] Fetching release definition: ${url}`);
      const response = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      if (!response.ok) {
        console.warn(`[Azure DevOps] Definition fetch failed ${response.status} ${response.statusText}`);
        return null;
      }
      return await response.json();
    } catch (err) {
      console.error('[Azure DevOps] Error fetching release definition:', err.message);
      return null;
    }
  }

  /**
   * Get latest build (YAML/classic build pipeline) for a given definition
   */
  async getLatestBuild(definitionId) {
    try {
      const url = `${this.organizationUrl}/${this.projectName}/_apis/build/builds?definitions=${definitionId}&$top=1&queryOrder=finishTimeDescending&api-version=7.0`;
      console.log(`[Azure DevOps] Fetching latest build from: ${url}`);
      const response = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      if (!response.ok) {
        console.error(`[Azure DevOps] Build API Error - URL: ${url} Status: ${response.status}`);
        return null; // Treat as no build available, don't throw to allow graceful fallback
      }
      const data = await response.json();
      return (data.value && data.value.length > 0) ? data.value[0] : null;
    } catch (err) {
      console.error('[Azure DevOps] Error fetching latest build:', err.message);
      return null;
    }
  }

  /**
   * Map build status/result to unified status
   */
  mapBuildStatus(build) {
    if (!build) return 'unknown';
    const { status, result } = build; // status: notStarted, inProgress, completed; result after completion
    if (status === 'inProgress' || status === 'cancelling') return 'inProgress';
    if (status === 'notStarted' || status === 'postponed') return 'notStarted';
    if (status === 'completed') {
      switch (result) {
        case 'succeeded': return 'succeeded';
        case 'partiallySucceeded': return 'partiallySucceeded';
        case 'failed': return 'failed';
        case 'canceled':
        case 'cancelled': return 'cancelled';
        default: return 'unknown';
      }
    }
    return 'unknown';
  }

  /**
   * Infer environment (dev/test) for a build via branch, name, or tags
   */
  inferBuildEnvironment(build) {
    if (!build) return 'dev';
    const branch = (build.sourceBranch || '').toLowerCase();
    const name = (build.definition?.name || '').toLowerCase();
    // Branch based
    if (branch.includes('/test') || branch.includes('/qa')) return 'test';
    if (branch.includes('/dev') || branch.includes('/develop')) return 'dev';
    // Name hints
    if (name.includes('test') || name.includes('qa')) return 'test';
    return 'dev';
  }

  /**
   * Transform build into release-like structure for compatibility
   */
  transformBuild(build) {
    if (!build) return null;
    const env = this.inferBuildEnvironment(build);
    const status = this.mapBuildStatus(build);
    return {
      releaseId: build.id,
      releaseName: build.buildNumber,
      version: build.sourceVersion || build.buildNumber,
      status,
      startTime: build.startTime ? new Date(build.startTime) : null,
      finishTime: build.finishTime ? new Date(build.finishTime) : null,
      deployedBy: build.requestedFor?.displayName || build.requestedFor?.uniqueName,
      webAccessUrl: build._links?.web?.href,
      environments: [
        {
          id: build.id,
          name: env === 'dev' ? 'Dev (Build)' : 'Test (Build)',
          status,
          environment: env,
          startTime: build.startTime ? new Date(build.startTime) : null,
          finishTime: build.finishTime ? new Date(build.finishTime) : null
        }
      ],
      _build: true
    };
  }

  /**
   * Transform Azure DevOps release data to our internal format
   */
  transformReleaseData(azureRelease) {
    const transformed = {
      releaseId: azureRelease.id,
      releaseName: azureRelease.name,
      version: azureRelease.name || azureRelease.releaseDefinition?.name,
      status: this.mapAzureStatus(azureRelease.status),
      startTime: azureRelease.createdOn ? new Date(azureRelease.createdOn) : null,
      finishTime: azureRelease.modifiedOn ? new Date(azureRelease.modifiedOn) : null,
      deployedBy: azureRelease.createdBy?.displayName || azureRelease.createdBy?.uniqueName,
      webAccessUrl: azureRelease._links?.web?.href,
      environments: []
    };

    // Process environments if available
    if (azureRelease.environments) {
      azureRelease.environments.forEach(env => {
        transformed.environments.push({
          id: env.id,
          name: env.name,
          status: this.mapAzureStatus(env.status),
          environment: this.mapEnvironmentName(env.name),
          startTime: env.createdOn ? new Date(env.createdOn) : null,
          finishTime: env.modifiedOn ? new Date(env.modifiedOn) : null
        });
      });
    }

    return transformed;
  }

  /**
   * Map Azure DevOps status to our internal status enum
   */
  mapAzureStatus(azureStatus) {
    const statusMap = {
      'undefined': 'unknown',
      'notStarted': 'notStarted',
      'inProgress': 'inProgress',
      'succeeded': 'succeeded',
      'partiallySucceeded': 'partiallySucceeded',
      'failed': 'failed',
      'canceled': 'cancelled',
      'cancelled': 'cancelled',
      'abandoned': 'abandoned'
    };

    return statusMap[azureStatus] || 'unknown';
  }

  /**
   * Map environment names to our standard environment types (dev/test only)
   */
  mapEnvironmentName(envName) {
    const name = envName.toLowerCase();
    
    // More comprehensive mapping for dev environment
    if (name.includes('dev') || name.includes('development') || name.includes('devel')) return 'dev';
    
    // More comprehensive mapping for test environment  
    if (name.includes('test') || name.includes('testing') || name.includes('tst') || name.includes('qa')) return 'test';
    
    // For environments we don't care about, default to 'dev' so they show up somewhere
    console.log(`[Azure DevOps] Unknown environment "${envName}", mapping to 'dev'`);
    return 'dev';
  }

  /**
   * Get release status for a specific pipeline definition
   */
  async getPipelineStatus(definitionId) {
    try {
      console.log(`[Azure DevOps] Fetching pipeline status for definition ID: ${definitionId}`);
      let releases = [];
      let transformedReleases = [];
      let releaseAttempted = false;
      let releaseError = null;

      // Attempt release API first
      try {
        releases = await this.getReleases(definitionId, 5);
        releaseAttempted = true;
        console.log(`[Azure DevOps] Found ${releases.length} releases for definition ${definitionId}`);
        transformedReleases = releases.map(r => this.transformReleaseData(r));
      } catch (err) {
        releaseError = err;
        if (String(err.message).includes('HTTP 404')) {
          console.warn(`[Azure DevOps] Release API 404 for definition ${definitionId}; verifying definition exists...`);
          const def = await this.getReleaseDefinition(definitionId);
          if (def) {
            console.warn('[Azure DevOps] Definition exists but releases endpoint returned 404. Possible permissions (Release Read) or path issue.');
          } else {
            console.warn('[Azure DevOps] Definition not found (null). Proceeding to build fallback.');
          }
        } else {
          console.warn(`[Azure DevOps] Release API error for definition ${definitionId}: ${err.message}`);
        }
      }

      // Fallback: if no release data, try build pipeline
      if (transformedReleases.length === 0) {
        console.log(`[Azure DevOps] No release data present, attempting build pipeline fallback for definition ${definitionId}`);
        const build = await this.getLatestBuild(definitionId);
        if (build) {
          const buildReleaseLike = this.transformBuild(build);
          if (buildReleaseLike) {
            transformedReleases = [buildReleaseLike];
            console.log('[Azure DevOps] Using build pipeline data for status.');
          }
        } else {
            console.log('[Azure DevOps] No build data available either.');
        }
      }
      
      // Get detailed environment status from the latest release (dev/test only)
      let currentStatus = {
        dev: 'unknown',
        test: 'unknown'
      };

      if (transformedReleases.length > 0) {
        const latestRelease = transformedReleases[0];
        console.log(`[Azure DevOps] Latest release: ${latestRelease.releaseName} (ID: ${latestRelease.releaseId})`);
        console.log(`[Azure DevOps] Release has ${latestRelease.environments?.length || 0} environments`);
        
        // If we have environment data, use it to update current status (only dev/test)
        if (latestRelease.environments && latestRelease.environments.length > 0) {
          console.log(`[Azure DevOps] Processing environments:`, latestRelease.environments.map(e => `${e.name} (${e.status})`));
          
          latestRelease.environments.forEach(env => {
            const envType = this.mapEnvironmentName(env.name);
            // Only track dev and test environments
            if (envType === 'dev' || envType === 'test') {
              currentStatus[envType] = env.status;
              console.log(`[Azure DevOps] ✓ Mapped environment "${env.name}" to ${envType} with status: ${env.status}`);
            } else {
              console.log(`[Azure DevOps] ✗ Skipping environment "${env.name}" (mapped to ${envType})`);
            }
          });
        } else {
          // If no environment breakdown, assume it's for 'dev' environment
          currentStatus.dev = latestRelease.status;
          console.log(`[Azure DevOps] No environments found, setting dev status to: ${latestRelease.status}`);
        }
      } else {
        console.log(`[Azure DevOps] No releases found for definition ${definitionId}`);
      }

      console.log(`[Azure DevOps] Final status for definition ${definitionId}:`, currentStatus);
      
      return {
        currentStatus,
        recentReleases: transformedReleases.slice(0, 10) // Keep last 10
      };
    } catch (error) {
      console.error(`Error getting pipeline status for definition ${definitionId}:`, error);
      throw error;
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      // Use the core API to test basic connectivity
      const url = `${this.organizationUrl}/_apis/projects/${encodeURIComponent(this.projectName)}?api-version=7.0`;
      console.log(`[Azure DevOps] Testing connection to: ${url}`);
      console.log(`[Azure DevOps] Organization URL: ${this.organizationUrl}`);
      console.log(`[Azure DevOps] Project Name: ${this.projectName}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.ok) {
        console.log(`[Azure DevOps] Connection test successful`);
        return {
          success: true,
          status: response.status,
          message: 'Connection successful'
        };
      } else {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[Azure DevOps] Connection test failed: ${response.status} ${response.statusText}`);
        console.error(`[Azure DevOps] Error details: ${errorText}`);
        return {
          success: false,
          status: response.status,
          message: `HTTP ${response.status}: ${response.statusText}. ${errorText}`
        };
      }
    } catch (error) {
      console.error(`[Azure DevOps] Connection test error:`, error);
      return {
        success: false,
        status: 0,
        message: error.message
      };
    }
  }
}

/**
 * Factory function to create Azure DevOps service instances
 */
export function createAzureDevOpsService(organizationUrl, projectName, personalAccessToken) {
  return new AzureDevOpsService(organizationUrl, projectName, personalAccessToken);
}

/**
 * Get Azure DevOps configuration from environment variables
 */
export function getAzureDevOpsConfig() {
  return {
    organizationUrl: process.env.AZURE_DEVOPS_ORG_URL || 'https://dev.azure.com/innovation-group',
    projectName: process.env.AZURE_DEVOPS_PROJECT || 'GG',
    personalAccessToken: process.env.AZURE_DEVOPS_PAT || null
  };
}

export default AzureDevOpsService;