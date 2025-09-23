import { Router } from 'express';
import { meta, generate, submit, tokenTest, tlsPeerCert, pollOrder } from '../controllers/dataGenController.js';

const r = Router();
r.get('/meta', meta);
r.post('/generate', generate);
r.post('/submit', submit);
r.post('/poll-order', pollOrder);
r.get('/token-test/:environment', tokenTest);
r.get('/tls-peercert/:environment', tlsPeerCert);

export default r;
