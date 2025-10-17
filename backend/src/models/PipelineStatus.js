import mongoose from "mongoose";

const PipelineReleaseSchema = new mongoose.Schema({
  releaseId: { type: Number, required: true }, // Azure DevOps release ID
  releaseName: { type: String, required: true },
  version: { type: String, default: null },
  status: { 
    type: String, 
    enum: ["notStarted", "inProgress", "succeeded", "partiallySucceeded", "failed", "cancelled", "abandoned", "unknown"], 
    required: true 
  },
  environment: { 
    type: String, 
    enum: ["dev", "test", "uat", "staging", "prod"], 
    required: true 
  },
  startTime: { type: Date, default: null },
  finishTime: { type: Date, default: null },
  deployedBy: { type: String, default: null },
  webAccessUrl: { type: String, default: null },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const PipelineStatusSchema = new mongoose.Schema({
  project: { 
    type: String, 
    enum: [
      "FNOL", "GlobalConfig", "Integration", "Opportunity", "Order", 
      "OutboundIntegration", "OperationalOutbound", "Party", "Search", 
      "OrderProcessor", "Estimate", "NRules-Financial", "NRules-Outbound", 
      "Guest", "MotorProxy", "FrontEnd-Insight", "FrontEnd-Guest", 
      "FrontEnd-Config", "FrontEnd-Motor"
    ], 
    required: true,
    index: true
  },
  definitionId: { type: Number, required: true }, // Azure DevOps release definition ID
  definitionName: { type: String, required: true },
  organizationUrl: { type: String, required: true }, // e.g., "https://dev.azure.com/innovation-group"
  projectName: { type: String, required: true }, // e.g., "GG"
  
  // Current status summary - focus on dev and test only
  currentStatus: {
    dev: { type: String, enum: ["notStarted", "inProgress", "succeeded", "partiallySucceeded", "failed", "cancelled", "abandoned", "unknown"], default: "unknown" },
    test: { type: String, enum: ["notStarted", "inProgress", "succeeded", "partiallySucceeded", "failed", "cancelled", "abandoned", "unknown"], default: "unknown" }
  },
  
  // Recent releases (keep last 10 for history)
  recentReleases: { type: [PipelineReleaseSchema], default: [] },
  
  // Configuration
  isActive: { type: Boolean, default: true },
  autoRefresh: { type: Boolean, default: true },
  refreshIntervalMinutes: { type: Number, default: 15 },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  lastSyncTime: { type: Date, default: null },
  lastSyncStatus: { type: String, enum: ["success", "failed", "pending"], default: "pending" },
  lastSyncError: { type: String, default: null }
}, { timestamps: true });

// Compound index for efficient queries
PipelineStatusSchema.index({ project: 1, definitionId: 1 }, { unique: true });
PipelineStatusSchema.index({ lastSyncTime: 1 });
PipelineStatusSchema.index({ isActive: 1 });

// Instance methods
PipelineStatusSchema.methods.updateRelease = function(releaseData) {
  // Add or update a release in the recentReleases array
  const existingIndex = this.recentReleases.findIndex(r => r.releaseId === releaseData.releaseId);
  
  if (existingIndex >= 0) {
    this.recentReleases[existingIndex] = releaseData;
  } else {
    this.recentReleases.push(releaseData);
    // Keep only the last 10 releases
    if (this.recentReleases.length > 10) {
      this.recentReleases = this.recentReleases
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, 10);
    }
  }
  
  // Update current status for the environment
  if (releaseData.environment && this.currentStatus.hasOwnProperty(releaseData.environment)) {
    this.currentStatus[releaseData.environment] = releaseData.status;
  }
  
  this.lastSyncTime = new Date();
  this.lastSyncStatus = "success";
  this.lastSyncError = null;
};

PipelineStatusSchema.methods.getStatusSummary = function() {
  const envs = Object.keys(this.currentStatus);
  const summary = {
    total: envs.length,
    succeeded: 0,
    failed: 0,
    inProgress: 0,
    unknown: 0
  };
  
  envs.forEach(env => {
    const status = this.currentStatus[env];
    if (status === "succeeded") summary.succeeded++;
    else if (status === "failed") summary.failed++;
    else if (status === "inProgress") summary.inProgress++;
    else summary.unknown++;
  });
  
  return summary;
};

// Static methods
PipelineStatusSchema.statics.findByProject = function(project) {
  return this.find({ project, isActive: true }).sort({ definitionName: 1 });
};

PipelineStatusSchema.statics.getOverallStatus = async function() {
  const pipelines = await this.find({ isActive: true });
  const projects = {};
  
  pipelines.forEach(pipeline => {
    if (!projects[pipeline.project]) {
      projects[pipeline.project] = {
        project: pipeline.project,
        pipelines: [],
        summary: { total: 0, succeeded: 0, failed: 0, inProgress: 0, unknown: 0 }
      };
    }
    
    projects[pipeline.project].pipelines.push({
      definitionName: pipeline.definitionName,
      currentStatus: pipeline.currentStatus,
      lastSyncTime: pipeline.lastSyncTime
    });
    
    const summary = pipeline.getStatusSummary();
    projects[pipeline.project].summary.total += summary.total;
    projects[pipeline.project].summary.succeeded += summary.succeeded;
    projects[pipeline.project].summary.failed += summary.failed;
    projects[pipeline.project].summary.inProgress += summary.inProgress;
    projects[pipeline.project].summary.unknown += summary.unknown;
  });
  
  return Object.values(projects);
};

export default mongoose.model("PipelineStatus", PipelineStatusSchema);