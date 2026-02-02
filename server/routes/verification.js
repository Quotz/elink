/**
 * Charger verification routes
 * Owner registration, charger verification requests, admin approval
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../auth');

// Note: '../database' is correct since we're in server/routes/

// Register as charger owner (requires auth)
router.post('/become-owner', authenticateToken, async (req, res) => {
  try {
    // Update user role to owner
    // Note: This is a simplified version - in production, you might want more verification
    const user = await db.getUserById(req.user.id);
    if (user.role === 'owner' || user.role === 'admin') {
      return res.json({ message: 'You are already registered as an owner' });
    }

    // TODO: Implement role update in database
    // For now, we'll just return success
    res.json({ 
      message: 'Owner registration initiated',
      nextSteps: [
        'Submit charger verification for each station you own',
        'Provide proof of ownership and electrical certifications'
      ]
    });
  } catch (error) {
    console.error('[Verification] Become owner error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Submit charger for verification (requires owner role)
router.post('/submit-charger', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { 
      chargerId, 
      serialNumber, 
      manufacturer, 
      model, 
      installationAddress,
      electricalCertUrl,
      ownershipProofUrl 
    } = req.body;

    if (!chargerId || !serialNumber || !installationAddress) {
      return res.status(400).json({ 
        error: 'Charger ID, serial number, and installation address are required' 
      });
    }

    // Check if charger exists
    const store = require('../store');
    const station = store.getStation(chargerId);
    if (!station) {
      return res.status(404).json({ error: 'Charger not found. Please ensure the charger has connected at least once.' });
    }

    // Check if already submitted
    const existing = await db.getChargerVerification(chargerId);
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ error: 'Charger verification already pending' });
    }

    // Create ownership record
    await db.createChargerOwner({
      userId: req.user.id,
      chargerId,
      documents: [electricalCertUrl, ownershipProofUrl].filter(Boolean)
    });

    // Create verification request
    const verification = await db.createChargerVerification({
      chargerId,
      ownerId: req.user.id,
      serialNumber,
      manufacturer,
      model,
      installationAddress,
      electricalCertUrl,
      ownershipProofUrl
    });

    res.status(201).json({
      message: 'Charger verification submitted successfully',
      verification: {
        id: verification.id,
        chargerId: verification.chargerId,
        status: verification.status,
        submittedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Verification] Submit charger error:', error);
    if (error.message === 'User already owns this charger') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Submission failed' });
  }
});

// Get my chargers (for owners)
router.get('/my-chargers', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    // Get all chargers owned by this user
    // This requires a new DB method - for now, we'll return pending verifications
    const store = require('../store');
    const allStations = store.getStations();
    
    // TODO: Filter by ownership from database
    res.json({
      chargers: allStations.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        connected: s.connected,
        // These would come from DB in full implementation
        ownershipStatus: 'unknown',
        verificationStatus: 'unknown'
      }))
    });
  } catch (error) {
    console.error('[Verification] Get my chargers error:', error);
    res.status(500).json({ error: 'Failed to retrieve chargers' });
  }
});

// Get verification status for a charger
router.get('/status/:chargerId', authenticateToken, async (req, res) => {
  try {
    const { chargerId } = req.params;
    
    const verification = await db.getChargerVerification(chargerId);
    if (!verification) {
      return res.json({ 
        chargerId,
        status: 'not_submitted',
        message: 'This charger has not been submitted for verification'
      });
    }

    // Check if user is owner or admin
    if (verification.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      chargerId,
      status: verification.status,
      submittedAt: verification.submitted_at ? new Date(verification.submitted_at * 1000).toISOString() : null,
      reviewedAt: verification.reviewed_at ? new Date(verification.reviewed_at * 1000).toISOString() : null,
      rejectionReason: verification.rejection_reason,
      notes: verification.notes
    });
  } catch (error) {
    console.error('[Verification] Get status error:', error);
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

// Admin: Get pending verifications
router.get('/admin/pending', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const pending = await db.getPendingVerifications(limit);

    res.json({
      count: pending.length,
      verifications: pending.map(v => ({
        id: v.id,
        chargerId: v.charger_id,
        owner: {
          id: v.owner_id,
          email: v.owner_email,
          name: `${v.first_name || ''} ${v.last_name || ''}`.trim()
        },
        serialNumber: v.serial_number,
        manufacturer: v.manufacturer,
        model: v.model,
        installationAddress: v.installation_address,
        electricalCertUrl: v.electrical_cert_url,
        ownershipProofUrl: v.ownership_proof_url,
        submittedAt: v.submitted_at ? new Date(v.submitted_at * 1000).toISOString() : null
      }))
    });
  } catch (error) {
    console.error('[Verification] Get pending error:', error);
    res.status(500).json({ error: 'Failed to retrieve pending verifications' });
  }
});

// Admin: Approve or reject verification
router.post('/admin/review', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { verificationId, status, rejectionReason, notes } = req.body;

    if (!verificationId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Verification ID and status (approved/rejected) required' });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason required when rejecting' });
    }

    const success = await db.updateVerificationStatus({
      verificationId,
      status,
      adminId: req.user.id,
      rejectionReason,
      notes
    });

    if (!success) {
      return res.status(404).json({ error: 'Verification request not found' });
    }

    // If approved, also mark the charger owner as verified
    if (status === 'approved') {
      const verification = await new Promise((resolve, reject) => {
        const sqlite3 = require('sqlite3').verbose();
        const db2 = new sqlite3.Database(require('path').join(__dirname, '..', '..', 'data', 'elink.db'));
        db2.get('SELECT charger_id FROM charger_verifications WHERE id = ?', [verificationId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
        db2.close();
      });
      
      if (verification) {
        await db.verifyChargerOwner(verification.charger_id, req.user.id);
      }
    }

    res.json({
      message: `Verification ${status}`,
      verificationId,
      status
    });
  } catch (error) {
    console.error('[Verification] Review error:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

module.exports = router;
