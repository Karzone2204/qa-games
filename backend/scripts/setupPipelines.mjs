#!/usr/bin/env node
/**
 * Pipeline Setup Script
 * 
 * This script registers all known pipelines with their definition IDs.
 * Run this after setting up your Azure DevOps PAT to quickly populate all pipelines.
 * 
 * Usage: node scripts/setupPipelines.mjs
 */

import dotenv from 'dotenv';

// Load environment variables from the backend directory
dotenv.config();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'karthikeyan.kalaiyarasu@innovation.group'; // Update with your admin email
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Salvation2025#'; // Update with your admin password

// Pipeline definitions with their Azure DevOps definition IDs
const PIPELINES = [
  // Backend Services
  { project: 'FNOL', definitionId: 79, definitionName: 'FNOL Service Release' },
  { project: 'GlobalConfig', definitionId: 64, definitionName: 'Global Config Service Release' },
  { project: 'Integration', definitionId: 191, definitionName: 'Integration Service Release' },
  { project: 'Opportunity', definitionId: 31, definitionName: 'Opportunity Service Release' },
  { project: 'Order', definitionId: 128, definitionName: 'Order Service Release' },
  { project: 'OutboundIntegration', definitionId: 209, definitionName: 'Outbound Integration Service Release' },
  { project: 'OperationalOutbound', definitionId: 124, definitionName: 'Operational Outbound Service Release' },
  { project: 'Party', definitionId: 47, definitionName: 'Party Service Release' },
  { project: 'Search', definitionId: 171, definitionName: 'Search Service Release' },
  { project: 'OrderProcessor', definitionId: 250, definitionName: 'Order Processor Service Release' },
  { project: 'Estimate', definitionId: 59, definitionName: 'Estimate Service Release' },
  { project: 'NRules-Financial', definitionId: 229, definitionName: 'NRules Financial Service Release' },
  { project: 'NRules-Outbound', definitionId: 165, definitionName: 'NRules Outbound Service Release' },
  { project: 'Guest', definitionId: 115, definitionName: 'Guest Service Release' },
  { project: 'MotorProxy', definitionId: 228, definitionName: 'Motor Proxy Service Release' },
  
  // Frontend Services
  { project: 'FrontEnd-Insight', definitionId: 197, definitionName: 'Frontend Insight Release' },
  { project: 'FrontEnd-Guest', definitionId: 196, definitionName: 'Frontend Guest Release' },
  { project: 'FrontEnd-Config', definitionId: 195, definitionName: 'Frontend Config Release' },
  { project: 'FrontEnd-Motor', definitionId: 194, definitionName: 'Frontend Motor Release' }
];

class PipelineSetup {
  constructor() {
    this.token = null;
  }

  async authenticate() {
    console.log('🔐 Authenticating with API...');
    
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token;
      console.log('✅ Authentication successful');
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      console.log('\n💡 Make sure:');
      console.log('1. Your backend server is running on', API_BASE);
      console.log('2. You have admin credentials set in environment variables:');
      console.log('   ADMIN_EMAIL=your-admin@innovation-group.co.uk');
      console.log('   ADMIN_PASSWORD=your-admin-password');
      return false;
    }
  }

  async testAzureConnection() {
    console.log('\n🔗 Testing Azure DevOps connection...');
    
    try {
      const response = await fetch(`${API_BASE}/api/pipelines/test-connection`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Azure DevOps connection successful');
        return true;
      } else {
        console.log('❌ Azure DevOps connection failed:', data.message);
        console.log('\n💡 Make sure you have set up your environment variables:');
        console.log('   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/innovation-group');
        console.log('   AZURE_DEVOPS_PROJECT=GG');
        console.log('   AZURE_DEVOPS_PAT=your_personal_access_token');
        return false;
      }
    } catch (error) {
      console.error('❌ Error testing Azure connection:', error.message);
      return false;
    }
  }

  async createPipeline(pipeline) {
    try {
      const response = await fetch(`${API_BASE}/api/pipelines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          project: pipeline.project,
          definitionId: pipeline.definitionId,
          definitionName: pipeline.definitionName,
          autoRefresh: true,
          refreshIntervalMinutes: 15
        })
      });

      if (response.status === 409) {
        console.log(`⚠️  ${pipeline.project} (ID: ${pipeline.definitionId}) already exists, skipping`);
        return { success: true, skipped: true };
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Created: ${pipeline.project} (ID: ${pipeline.definitionId})`);
      return { success: true, data };
    } catch (error) {
      console.log(`❌ Failed to create ${pipeline.project}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async setupAllPipelines() {
    console.log(`\n🚀 Setting up ${PIPELINES.length} pipelines...\n`);
    
    const results = {
      created: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (const pipeline of PIPELINES) {
      const result = await this.createPipeline(pipeline);
      
      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.created++;
        }
      } else {
        results.failed++;
        results.errors.push({
          pipeline: pipeline.project,
          error: result.error
        });
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  async syncAllPipelines() {
    console.log('\n🔄 Syncing all pipelines with Azure DevOps...');
    
    try {
      const response = await fetch(`${API_BASE}/api/pipelines/sync/all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Sync completed: ${data.data.successful}/${data.data.total} pipelines synced successfully`);
      
      if (data.data.failed > 0) {
        console.log(`⚠️  ${data.data.failed} pipelines failed to sync`);
        if (data.data.errors.length > 0) {
          console.log('Errors:', data.data.errors);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      return false;
    }
  }

  async run() {
    console.log('🔧 Pipeline Setup Script');
    console.log('========================\n');
    console.log('API Base URL:', API_BASE);
    console.log('Admin Email:', ADMIN_EMAIL);
    console.log('Password provided:', ADMIN_PASSWORD ? 'Yes' : 'No');
    console.log('Environment check:');
    console.log('- AZURE_DEVOPS_ORG_URL:', process.env.AZURE_DEVOPS_ORG_URL || 'Not set');
    console.log('- AZURE_DEVOPS_PROJECT:', process.env.AZURE_DEVOPS_PROJECT || 'Not set');
    console.log('- AZURE_DEVOPS_PAT:', process.env.AZURE_DEVOPS_PAT ? 'Set' : 'Not set');
    console.log('');

    // Step 1: Authenticate
    const authenticated = await this.authenticate();
    if (!authenticated) {
      process.exit(1);
    }

    // Step 2: Test Azure DevOps connection
    const azureConnected = await this.testAzureConnection();
    if (!azureConnected) {
      console.log('\n⚠️  Continuing without Azure DevOps connection. Pipelines will be created but not synced.');
    }

    // Step 3: Create all pipelines
    const results = await this.setupAllPipelines();

    // Step 4: Sync pipelines if Azure is connected
    if (azureConnected && (results.created > 0 || results.skipped > 0)) {
      await this.syncAllPipelines();
    }

    // Summary
    console.log('\n📊 Setup Summary');
    console.log('================');
    console.log(`✅ Created: ${results.created} pipelines`);
    console.log(`⚠️  Skipped: ${results.skipped} pipelines (already exist)`);
    console.log(`❌ Failed: ${results.failed} pipelines`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(({ pipeline, error }) => {
        console.log(`   ${pipeline}: ${error}`);
      });
    }

    console.log('\n🎉 Setup complete! You can now view pipeline status in the QA Tools section.');
    
    if (!azureConnected) {
      console.log('\n💡 To enable real-time pipeline status:');
      console.log('1. Set up your Azure DevOps Personal Access Token');
      console.log('2. Run the sync command from the admin panel');
    }
  }
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new PipelineSetup();
  setup.run().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

export default PipelineSetup;