/**
 * User profile and charging history routes
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken: authenticate } = require('../auth');

// Phone validation regex (basic international format)
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/;

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      emailVerified: !!user.email_verified,
      phoneVerified: !!user.phone_verified,
      createdAt: new Date(user.created_at * 1000).toISOString()
    });
  } catch (error) {
    console.error('[Users] Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const updates = {};

    // Validate and prepare updates
    if (firstName !== undefined) {
      if (firstName.length > 50) {
        return res.status(400).json({ error: 'First name too long (max 50 chars)' });
      }
      updates.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (lastName.length > 50) {
        return res.status(400).json({ error: 'Last name too long (max 50 chars)' });
      }
      updates.lastName = lastName.trim();
    }

    if (phone !== undefined) {
      if (phone && !PHONE_REGEX.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      updates.phone = phone ? phone.trim() : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updatedUser = await db.updateUserProfile(req.user.id, updates);
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        emailVerified: !!updatedUser.email_verified,
        phoneVerified: !!updatedUser.phone_verified
      }
    });
  } catch (error) {
    console.error('[Users] Update profile error:', error);
    if (error.message.includes('UNIQUE constraint failed') && error.message.includes('phone')) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user's charging history
router.get('/charging-history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const history = await db.getUserChargingHistory(req.user.id, limit, offset);
    
    res.json({
      history: history.map(session => ({
        id: session.id,
        chargerId: session.charger_id,
        idTag: session.id_tag,
        startTime: new Date(session.start_time * 1000).toISOString(),
        endTime: session.end_time ? new Date(session.end_time * 1000).toISOString() : null,
        startMeter: session.start_meter,
        endMeter: session.end_meter,
        totalKwh: session.total_kwh,
        totalCost: session.total_cost,
        currency: session.currency,
        status: session.status,
        paymentStatus: session.payment_status
      })),
      limit,
      offset
    });
  } catch (error) {
    console.error('[Users] Charging history error:', error);
    res.status(500).json({ error: 'Failed to get charging history' });
  }
});

// Get user statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await db.getUserStats(req.user.id);
    
    res.json({
      totalSessions: stats.totalSessions || 0,
      totalEnergyKwh: stats.totalEnergyKwh || 0,
      totalSpent: stats.totalSpent || 0,
      favoriteCharger: stats.favoriteCharger || null,
      lastSession: stats.lastSession ? new Date(stats.lastSession * 1000).toISOString() : null
    });
  } catch (error) {
    console.error('[Users] Stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// Admin: list all users
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await db.getAllUsers();
    res.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        emailVerified: !!u.email_verified,
        createdAt: new Date(u.created_at * 1000).toISOString()
      }))
    });
  } catch (error) {
    console.error('[Users] Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

module.exports = router;
