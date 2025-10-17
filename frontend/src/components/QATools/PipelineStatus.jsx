import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { toast } from '../../services/toast.js';

export default function PipelineStatus() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState('all');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const projects = [
    'FNOL', 'GlobalConfig', 'Integration', 'Opportunity', 'Order', 
    'OutboundIntegration', 'OperationalOutbound', 'Party', 'Search', 
    'OrderProcessor', 'Estimate', 'NRules-Financial', 'NRules-Outbound', 
    'Guest', 'MotorProxy', 'FrontEnd-Insight', 'FrontEnd-Guest', 
    'FrontEnd-Config', 'FrontEnd-Motor'
  ];

  useEffect(() => {
    fetchPipelines();
  }, [selectedProject]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchPipelines, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh]);

  const fetchPipelines = async () => {
    try {
      const response = selectedProject === 'all' 
        ? await api.pipelinesGetAll()
        : await api.pipelinesGetByProject(selectedProject);
      
      setPipelines(response.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching pipelines:', err);
      setError(err.response?.data?.message || 'Failed to fetch pipeline status');
      toast.error('Failed to fetch pipeline status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      succeeded: '#4CAF50',
      failed: '#F44336',
      inProgress: '#FF9800',
      partiallySucceeded: '#FF5722',
      cancelled: '#9E9E9E',
      abandoned: '#9E9E9E',
      notStarted: '#2196F3',
      unknown: '#757575'
    };
    return colors[status] || colors.unknown;
  };

  const getStatusIcon = (status) => {
    const icons = {
      succeeded: '✅',
      failed: '❌',
      inProgress: '🔄',
      partiallySucceeded: '⚠️',
      cancelled: '⏹️',
      abandoned: '❓',
      notStarted: '⏸️',
      unknown: '❓'
    };
    return icons[status] || icons.unknown;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getEnvironmentStatusCard = (envName, status, pipeline) => {
    const envReleases = pipeline.recentReleases?.filter(r => r.environment === envName) || [];
    const latestRelease = envReleases[0];

    return (
      <div 
        key={envName}
        style={{
          border: `2px solid ${getStatusColor(status)}`,
          borderRadius: '8px',
          padding: '12px',
          margin: '4px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          minWidth: '120px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
          {envName}
        </div>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>
          {getStatusIcon(status)}
        </div>
        <div style={{ fontSize: '12px', color: getStatusColor(status), fontWeight: 'bold' }}>
          {status.replace(/([A-Z])/g, ' $1').trim()}
        </div>
        {latestRelease && (
          <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.8 }}>
            <div>Release: {latestRelease.releaseName}</div>
            {latestRelease.finishTime && (
              <div>{formatDate(latestRelease.finishTime)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const syncPipeline = async (pipelineId) => {
    try {
      await api.pipelinesSync(pipelineId);
      toast.success('Pipeline synced successfully');
      await fetchPipelines();
    } catch (err) {
      console.error('Error syncing pipeline:', err);
      toast.error('Failed to sync pipeline');
    }
  };

  const syncAllPipelines = async () => {
    try {
      setLoading(true);
      const response = await api.pipelinesSyncAll();
      toast.success(`Synced ${response.data.successful}/${response.data.total} pipelines`);
      await fetchPipelines();
    } catch (err) {
      console.error('Error syncing all pipelines:', err);
      toast.error('Failed to sync pipelines');
    } finally {
      setLoading(false);
    }
  };

  if (loading && pipelines.length === 0) {
    return (
      <div className="game-container active" style={{ textAlign: 'center' }}>
        <h2>🚀 Pipeline Status</h2>
        <p>Loading pipeline status...</p>
      </div>
    );
  }

  return (
    <div className="game-container active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🚀 Pipeline Status Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={fetchPipelines} disabled={loading}>
            {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
          <button onClick={syncAllPipelines} disabled={loading}>
            📥 Sync All
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label>Filter by project:</label>
        <select 
          value={selectedProject} 
          onChange={(e) => setSelectedProject(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="all">All Projects</option>
          {projects.map(project => (
            <option key={project} value={project}>{project}</option>
          ))}
        </select>
        
        {lastRefresh && (
          <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '20px' }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: 'rgba(244, 67, 54, 0.1)', 
          border: '1px solid #F44336', 
          borderRadius: '4px', 
          padding: '12px', 
          marginBottom: '20px',
          color: '#F44336'
        }}>
          ⚠️ {error}
        </div>
      )}

      {pipelines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No pipelines found for the selected project.</p>
          <p style={{ fontSize: '14px', opacity: 0.7 }}>
            Pipelines need to be registered first in the admin panel.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {pipelines.map(pipeline => (
            <div 
              key={pipeline._id}
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                padding: '20px',
                backgroundColor: 'rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      backgroundColor: 'rgba(33, 150, 243, 0.2)', 
                      color: '#2196F3', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {pipeline.project}
                    </span>
                    {pipeline.definitionName}
                  </h3>
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
                    Definition ID: {pipeline.definitionId}
                  </p>
                  {pipeline.lastSyncTime && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.6 }}>
                      Last sync: {formatDate(pipeline.lastSyncTime)}
                      {pipeline.lastSyncStatus === 'failed' && (
                        <span style={{ color: '#F44336', marginLeft: '8px' }}>
                          ❌ Failed
                          {pipeline.lastSyncError && (
                            <span style={{ fontSize: '10px', display: 'block' }}>
                              {pipeline.lastSyncError}
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => syncPipeline(pipeline._id)}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px',
                      backgroundColor: 'rgba(33, 150, 243, 0.2)',
                      border: '1px solid #2196F3',
                      borderRadius: '4px',
                      color: '#2196F3',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Sync
                  </button>
                  {pipeline.webAccessUrl && (
                    <a 
                      href={pipeline.webAccessUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        border: '1px solid #4CAF50',
                        borderRadius: '4px',
                        color: '#4CAF50',
                        textDecoration: 'none',
                        display: 'inline-block'
                      }}
                    >
                      🔗 View in Azure
                    </a>
                  )}
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                flexWrap: 'wrap',
                justifyContent: 'space-around'
              }}>
                {Object.entries(pipeline.currentStatus).map(([env, status]) => 
                  getEnvironmentStatusCard(env, status, pipeline)
                )}
              </div>

              {pipeline.recentReleases && pipeline.recentReleases.length > 0 && (
                <details style={{ marginTop: '16px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
                    Recent Releases ({pipeline.recentReleases.length})
                  </summary>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {pipeline.recentReleases.slice(0, 5).map(release => (
                      <div 
                        key={`${release.releaseId}-${release.environment}`}
                        style={{
                          padding: '8px',
                          margin: '4px 0',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{release.releaseName}</span>
                          <span style={{ 
                            marginLeft: '8px', 
                            padding: '2px 6px', 
                            backgroundColor: 'rgba(150, 150, 150, 0.2)', 
                            borderRadius: '3px',
                            fontSize: '10px'
                          }}>
                            {release.environment}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: getStatusColor(release.status) }}>
                            {getStatusIcon(release.status)} {release.status}
                          </span>
                          {release.finishTime && (
                            <span style={{ opacity: 0.7 }}>
                              {formatDate(release.finishTime)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}