import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.js';
import { toast } from '../../../services/toast.js';
import ConfirmDialog from '../../UI/ConfirmDialog.jsx';

export default function PipelinesTab() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [connectionTest, setConnectionTest] = useState(null);
  const [formData, setFormData] = useState({
    project: '',
    definitionId: '',
    definitionName: '',
    organizationUrl: '',
    projectName: '',
    autoRefresh: true,
    refreshIntervalMinutes: 15
  });

  const projects = [
    'FNOL', 'GlobalConfig', 'Integration', 'Opportunity', 'Order', 
    'OutboundIntegration', 'OperationalOutbound', 'Party', 'Search', 
    'OrderProcessor', 'Estimate', 'NRules-Financial', 'NRules-Outbound', 
    'Guest', 'MotorProxy', 'FrontEnd-Insight', 'FrontEnd-Guest', 
    'FrontEnd-Config', 'FrontEnd-Motor'
  ];

  useEffect(() => {
    fetchPipelines();
    testConnection();
  }, []);

  const fetchPipelines = async () => {
    try {
      const response = await api.pipelinesGetAll();
      setPipelines(response.data);
    } catch (err) {
      console.error('Error fetching pipelines:', err);
      toast.error('Failed to fetch pipelines');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const response = await api.pipelinesTestConnection();
      setConnectionTest(response.data);
    } catch (err) {
      setConnectionTest({
        success: false,
        message: err.response?.data?.message || 'Connection test failed'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.project || !formData.definitionId || !formData.definitionName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingPipeline) {
        await api.pipelinesUpdate(editingPipeline._id, formData);
        toast.success('Pipeline updated successfully');
      } else {
        await api.pipelinesCreate(formData);
        toast.success('Pipeline created successfully');
      }
      
      setShowForm(false);
      setEditingPipeline(null);
      resetForm();
      await fetchPipelines();
    } catch (err) {
      console.error('Error saving pipeline:', err);
      toast.error(err.response?.data?.message || 'Failed to save pipeline');
    }
  };

  const handleEdit = (pipeline) => {
    setEditingPipeline(pipeline);
    setFormData({
      project: pipeline.project,
      definitionId: pipeline.definitionId,
      definitionName: pipeline.definitionName,
      organizationUrl: pipeline.organizationUrl || '',
      projectName: pipeline.projectName || '',
      autoRefresh: pipeline.autoRefresh,
      refreshIntervalMinutes: pipeline.refreshIntervalMinutes
    });
    setShowForm(true);
  };

  const handleDelete = async (pipeline) => {
    try {
      await api.pipelinesDelete(pipeline._id);
      toast.success('Pipeline deleted successfully');
      setDeleteConfirm(null);
      await fetchPipelines();
    } catch (err) {
      console.error('Error deleting pipeline:', err);
      toast.error('Failed to delete pipeline');
    }
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
      const response = await api.pipelinesSyncAll();
      toast.success(`Synced ${response.data.successful}/${response.data.total} pipelines`);
      await fetchPipelines();
    } catch (err) {
      console.error('Error syncing all pipelines:', err);
      toast.error('Failed to sync pipelines');
    }
  };

  const resetForm = () => {
    setFormData({
      project: '',
      definitionId: '',
      definitionName: '',
      organizationUrl: '',
      projectName: '',
      autoRefresh: true,
      refreshIntervalMinutes: 15
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      success: '#4CAF50',
      failed: '#F44336',
      pending: '#FF9800'
    };
    return colors[status] || '#757575';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div>Loading pipelines...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Pipeline Management</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={syncAllPipelines}>
            📥 Sync All Pipelines
          </button>
          <button onClick={() => setShowForm(true)}>
            ➕ Add Pipeline
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{
        padding: '12px',
        borderRadius: '6px',
        marginBottom: '20px',
        backgroundColor: connectionTest?.success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
        border: `1px solid ${connectionTest?.success ? '#4CAF50' : '#F44336'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{connectionTest?.success ? '✅' : '❌'}</span>
          <strong>Azure DevOps Connection:</strong>
          <span>{connectionTest?.message || 'Unknown'}</span>
          <button 
            onClick={testConnection}
            style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '12px' }}
          >
            🔄 Test
          </button>
        </div>
      </div>

      {/* Pipeline Form */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            padding: '24px',
            borderRadius: '8px',
            width: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3>{editingPipeline ? 'Edit Pipeline' : 'Add New Pipeline'}</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label>Project *</label>
                <select
                  value={formData.project}
                  onChange={(e) => setFormData({...formData, project: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                >
                  <option value="">Select Project</option>
                  {projects.map(project => (
                    <option key={project} value={project}>{project}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Definition ID *</label>
                <input
                  type="number"
                  value={formData.definitionId}
                  onChange={(e) => setFormData({...formData, definitionId: e.target.value})}
                  placeholder="e.g., 79"
                  required
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label>Definition Name *</label>
                <input
                  type="text"
                  value={formData.definitionName}
                  onChange={(e) => setFormData({...formData, definitionName: e.target.value})}
                  placeholder="e.g., Order Service Release"
                  required
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label>Organization URL</label>
                <input
                  type="url"
                  value={formData.organizationUrl}
                  onChange={(e) => setFormData({...formData, organizationUrl: e.target.value})}
                  placeholder="https://dev.azure.com/innovation-group"
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label>Project Name</label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                  placeholder="GG"
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={formData.autoRefresh}
                  onChange={(e) => setFormData({...formData, autoRefresh: e.target.checked})}
                />
                <label htmlFor="autoRefresh">Enable Auto Refresh</label>
              </div>

              <div>
                <label>Refresh Interval (minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={formData.refreshIntervalMinutes}
                  onChange={(e) => setFormData({...formData, refreshIntervalMinutes: parseInt(e.target.value)})}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingPipeline(null);
                    resetForm();
                  }}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white' }}
                >
                  {editingPipeline ? 'Update' : 'Create'} Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pipelines List */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Project</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Definition</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Status Summary</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Last Sync</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.map(pipeline => {
              const statusCounts = Object.values(pipeline.currentStatus).reduce((acc, status) => {
                acc[status] = (acc[status] || 0) + 1;
                return acc;
              }, {});

              return (
                <tr key={pipeline._id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      backgroundColor: 'rgba(33, 150, 243, 0.2)',
                      color: '#2196F3',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {pipeline.project}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold' }}>{pipeline.definitionName}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>ID: {pipeline.definitionId}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(statusCounts).map(([status, count]) => (
                        <span
                          key={status}
                          style={{
                            backgroundColor: `${getStatusColor(status)}20`,
                            color: getStatusColor(status),
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '11px'
                          }}
                        >
                          {status}: {count}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontSize: '12px' }}>
                      {formatDate(pipeline.lastSyncTime)}
                    </div>
                    {pipeline.lastSyncStatus && (
                      <div style={{
                        fontSize: '10px',
                        color: getStatusColor(pipeline.lastSyncStatus),
                        marginTop: '2px'
                      }}>
                        {pipeline.lastSyncStatus === 'success' ? '✅' : '❌'} {pipeline.lastSyncStatus}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => syncPipeline(pipeline._id)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        title="Sync with Azure DevOps"
                      >
                        🔄
                      </button>
                      <button
                        onClick={() => handleEdit(pipeline)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        title="Edit pipeline"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(pipeline)}
                        style={{ padding: '4px 8px', fontSize: '12px', color: '#F44336' }}
                        title="Delete pipeline"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pipelines.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.7 }}>
          <p>No pipelines configured yet.</p>
          <p style={{ fontSize: '14px' }}>
            Click "Add Pipeline" to register your first Azure DevOps release pipeline.
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Pipeline"
          message={`Are you sure you want to delete the pipeline "${deleteConfirm.definitionName}" for ${deleteConfirm.project}? This action cannot be undone.`}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}