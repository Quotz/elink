const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate } = require('../auth');

// Register push token
router.post('/token', authenticate, async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    await db.savePushToken({
      userId: req.user.id,
      token,
      platform
    });

    res.json({ message: 'Token registered successfully' });
  } catch (error) {
    console.error('Save push token error:', error);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// Remove push token
router.delete('/token', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    await db.deletePushToken(token);
    res.json({ message: 'Token removed successfully' });
  } catch (error) {
    console.error('Delete push token error:', error);
    res.status(500).json({ error: 'Failed to remove token' });
  }
});

module.exports = router;
