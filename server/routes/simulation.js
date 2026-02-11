const express = require('express');
const router = express.Router();
const simulator = require('../simulator');
const { authenticateToken, requireRole } = require('../auth');

router.post('/connect/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateConnect(req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

router.post('/start/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateStart(req.params.id, req.body);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

router.post('/stop/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateStop(req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

router.post('/disconnect/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const result = simulator.simulateDisconnect(req.params.id);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

router.post('/demo-setup', authenticateToken, requireRole('admin'), (req, res) => {
  const results = simulator.setupDemoScenario();
  res.json(results);
});

router.get('/status', authenticateToken, requireRole('admin'), (req, res) => {
  res.json(simulator.getStatus());
});

module.exports = router;
