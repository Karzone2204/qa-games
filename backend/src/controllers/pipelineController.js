import PipelineStatus from '../models/PipelineStatus.js';
import { createAzureDevOpsService, getAzureDevOpsConfig } from '../services/azureDevOpsService.js';

/**
 * Get all pipeline statuses with optional filtering
 */
export async function getAllPipelines(req, res) {
  try {
    const { project, active } = req.query;
    const filter = {};
    
    if (project) filter.project = project;
    if (active !== undefined) filter.isActive = active === 'true';
    
    const pipelines = await PipelineStatus.find(filter)
      .populate('createdBy', 'name email')
      .sort({ project: 1, definitionName: 1 });
    
    res.json({
      success: true,
      data: pipelines,
      count: pipelines.length
    });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline statuses',
      message: error.message
    });
  }
}

/**
 * Get pipeline status by ID
 */
export async function getPipelineById(req, res) {
  try {
    const { id } = req.params;
    const pipeline = await PipelineStatus.findById(id)
      .populate('createdBy', 'name email');
    
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }
    
    res.json({
      success: true,
      data: pipeline
    });
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline status',
      message: error.message
    });
  }
}

/**
 * Get pipelines by project
 */
export async function getPipelinesByProject(req, res) {
  try {
    const { project } = req.params;
    const pipelines = await PipelineStatus.findByProject(project)
      .populate('createdBy', 'name email');
    
    res.json({
      success: true,
      data: pipelines,
      project,
      count: pipelines.length
    });
  } catch (error) {
    console.error('Error fetching pipelines by project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project pipelines',
      message: error.message
    });
  }
}

/**
 * Get overall status summary for dashboard
 */
export async function getOverallStatus(req, res) {
  try {
    const status = await PipelineStatus.getOverallStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching overall status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overall pipeline status',
      message: error.message
    });
  }
}

/**
 * Create or register a new pipeline
 */
export async function createPipeline(req, res) {
  try {
    const {
      project,
      definitionId,
      definitionName,
      organizationUrl,
      projectName,
      autoRefresh,
      refreshIntervalMinutes
    } = req.body;
    
    // Validate required fields
    if (!project || !definitionId || !definitionName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: project, definitionId, definitionName'
      });
    }
    
    // Check if pipeline already exists
    const existing = await PipelineStatus.findOne({ project, definitionId });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Pipeline already exists for this project and definition ID'
      });
    }
    
    const config = getAzureDevOpsConfig();
    
    const pipelineData = {
      project,
      definitionId,
      definitionName,
      organizationUrl: organizationUrl || config.organizationUrl,
      projectName: projectName || config.projectName,
      autoRefresh: autoRefresh !== undefined ? autoRefresh : true,
      refreshIntervalMinutes: refreshIntervalMinutes || 15,
      createdBy: req.user?.id || null
    };
    
    const pipeline = new PipelineStatus(pipelineData);
    await pipeline.save();
    
    // Attempt initial sync if PAT is available
    if (config.personalAccessToken) {
      try {
        await syncPipelineStatus(pipeline._id, false); // Don't wait for sync to complete
      } catch (syncError) {
        console.warn('Initial sync failed:', syncError.message);
      }
    }
    
    res.status(201).json({
      success: true,
      data: pipeline,
      message: 'Pipeline created successfully'
    });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pipeline',
      message: error.message
    });
  }
}

/**
 * Update pipeline configuration
 */
export async function updatePipeline(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdBy;
    delete updates.recentReleases;
    delete updates.currentStatus;
    delete updates.lastSyncTime;
    delete updates.lastSyncStatus;
    delete updates.lastSyncError;
    
    const pipeline = await PipelineStatus.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }
    
    res.json({
      success: true,
      data: pipeline,
      message: 'Pipeline updated successfully'
    });
  } catch (error) {
    console.error('Error updating pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pipeline',
      message: error.message
    });
  }
}

/**
 * Delete pipeline
 */
export async function deletePipeline(req, res) {
  try {
    const { id } = req.params;
    
    const pipeline = await PipelineStatus.findByIdAndDelete(id);
    
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Pipeline deleted successfully',
      data: { id: pipeline._id, project: pipeline.project, definitionName: pipeline.definitionName }
    });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete pipeline',
      message: error.message
    });
  }
}

/**
 * Sync pipeline status with Azure DevOps
 */
export async function syncPipeline(req, res) {
  try {
    const { id } = req.params;
    const result = await syncPipelineStatus(id, true);
    
    res.json({
      success: true,
      data: result,
      message: 'Pipeline sync completed'
    });
  } catch (error) {
    console.error('Error syncing pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync pipeline status',
      message: error.message
    });
  }
}

/**
 * Sync all active pipelines
 */
export async function syncAllPipelines(req, res) {
  try {
    const pipelines = await PipelineStatus.find({ isActive: true, autoRefresh: true });
    
    const results = await Promise.allSettled(
      pipelines.map(pipeline => syncPipelineStatus(pipeline._id, false))
    );
    
    const summary = {
      total: pipelines.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      errors: results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message || 'Unknown error')
    };
    
    res.json({
      success: true,
      data: summary,
      message: `Synced ${summary.successful}/${summary.total} pipelines successfully`
    });
  } catch (error) {
    console.error('Error syncing all pipelines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync pipelines',
      message: error.message
    });
  }
}

/**
 * Test Azure DevOps API connection
 */
export async function testConnection(req, res) {
  try {
    const config = getAzureDevOpsConfig();
    
    if (!config.personalAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'Azure DevOps Personal Access Token not configured'
      });
    }
    
    const service = createAzureDevOpsService(
      config.organizationUrl,
      config.projectName,
      config.personalAccessToken
    );
    
    const result = await service.testConnection();
    
    res.json({
      success: result.success,
      data: result,
      message: result.message
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Azure DevOps connection',
      message: error.message
    });
  }
}

/**
 * Internal function to sync a single pipeline's status
 */
async function syncPipelineStatus(pipelineId, detailed = false) {
  const pipeline = await PipelineStatus.findById(pipelineId);
  if (!pipeline) {
    throw new Error('Pipeline not found');
  }
  
  const config = getAzureDevOpsConfig();
  if (!config.personalAccessToken) {
    throw new Error('Azure DevOps Personal Access Token not configured');
  }
  
  try {
    const service = createAzureDevOpsService(
      pipeline.organizationUrl || config.organizationUrl,
      pipeline.projectName || config.projectName,
      config.personalAccessToken
    );
    
    const statusData = await service.getPipelineStatus(pipeline.definitionId);
    
    // Update current status
    pipeline.currentStatus = statusData.currentStatus;
    
    // Update recent releases
    if (statusData.recentReleases && statusData.recentReleases.length > 0) {
      statusData.recentReleases.forEach(release => {
        // Process each environment in the release
        if (release.environments && release.environments.length > 0) {
          release.environments.forEach(env => {
            const releaseData = {
              releaseId: release.releaseId,
              releaseName: release.releaseName,
              version: release.version,
              status: env.status,
              environment: env.environment,
              startTime: env.startTime,
              finishTime: env.finishTime,
              deployedBy: release.deployedBy,
              webAccessUrl: release.webAccessUrl,
              lastUpdated: new Date()
            };
            pipeline.updateRelease(releaseData);
          });
        } else {
          // No environment breakdown, treat as single environment release
          const releaseData = {
            releaseId: release.releaseId,
            releaseName: release.releaseName,
            version: release.version,
            status: release.status,
            environment: 'dev', // Default to dev if no environment specified
            startTime: release.startTime,
            finishTime: release.finishTime,
            deployedBy: release.deployedBy,
            webAccessUrl: release.webAccessUrl,
            lastUpdated: new Date()
          };
          pipeline.updateRelease(releaseData);
        }
      });
    }
    
    pipeline.lastSyncTime = new Date();
    pipeline.lastSyncStatus = 'success';
    pipeline.lastSyncError = null;
    
    await pipeline.save();
    
    return {
      pipelineId: pipeline._id,
      project: pipeline.project,
      definitionName: pipeline.definitionName,
      currentStatus: pipeline.currentStatus,
      releasesUpdated: statusData.recentReleases?.length || 0,
      lastSyncTime: pipeline.lastSyncTime
    };
  } catch (error) {
    pipeline.lastSyncTime = new Date();
    pipeline.lastSyncStatus = 'failed';
    pipeline.lastSyncError = error.message;
    await pipeline.save();
    
    throw error;
  }
}