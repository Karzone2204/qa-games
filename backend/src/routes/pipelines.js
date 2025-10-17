import { Router } from 'express';
import {
  getAllPipelines,
  getPipelineById,
  getPipelinesByProject,
  getOverallStatus,
  createPipeline,
  updatePipeline,
  deletePipeline,
  syncPipeline,
  syncAllPipelines,
  testConnection
} from '../controllers/pipelineController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public routes (for dashboard viewing)
router.get('/status/overview', getOverallStatus);
router.get('/status', getAllPipelines);
router.get('/status/project/:project', getPipelinesByProject);

// Protected routes (require authentication)
router.use(requireAuth);

router.get('/test-connection', testConnection);
router.get('/:id', getPipelineById);
router.post('/', createPipeline);
router.put('/:id', updatePipeline);
router.delete('/:id', deletePipeline);

// Sync operations
router.post('/:id/sync', syncPipeline);
router.post('/sync/all', syncAllPipelines);

export default router;