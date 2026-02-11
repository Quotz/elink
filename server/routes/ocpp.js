const express = require('express');
const router = express.Router();
const store = require('../store');
const ocppCommands = require('../ocpp-commands');

router.get('/:id/configuration', async (req, res) => {
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.connected) return res.status(400).json({ error: 'Charger is offline' });
  try {
    const result = await ocppCommands.getConfiguration(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/trigger', async (req, res) => {
  const { message, connectorId } = req.body;
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.connected) return res.status(400).json({ error: 'Charger is offline' });
  try {
    const result = await ocppCommands.triggerMessage(req.params.id, message, connectorId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/configure', async (req, res) => {
  const { key, value } = req.body;
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.connected) return res.status(400).json({ error: 'Charger is offline' });
  try {
    const result = await ocppCommands.changeConfiguration(req.params.id, key, value);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/diagnostics', async (req, res) => {
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json({
    configuration: station.configuration || null,
    capabilities: station.capabilities || null,
    diagnostics: station.diagnostics || {},
    vendor: station.vendor,
    model: station.model,
    serialNumber: station.serialNumber,
    firmwareVersion: station.firmwareVersion
  });
});

router.post('/:id/reset', async (req, res) => {
  const { type } = req.body;
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.connected) return res.status(400).json({ error: 'Charger is offline' });
  try {
    const result = await ocppCommands.reset(req.params.id, type || 'Soft');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/unlock', async (req, res) => {
  const { connectorId } = req.body;
  const station = store.getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (!station.connected) return res.status(400).json({ error: 'Charger is offline' });
  try {
    const result = await ocppCommands.unlockConnector(req.params.id, connectorId || 1);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
