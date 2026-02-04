const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken: authenticate } = require('../auth');

// Create a reservation
router.post('/', authenticate, async (req, res) => {
  try {
    const { chargerId, startTime } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!chargerId || !startTime) {
      return res.status(400).json({ error: 'Charger ID and start time required' });
    }

    // Parse start time
    const start = Math.floor(new Date(startTime).getTime() / 1000);
    if (isNaN(start)) {
      return res.status(400).json({ error: 'Invalid start time' });
    }

    // Must be in future
    const now = Math.floor(Date.now() / 1000);
    if (start < now) {
      return res.status(400).json({ error: 'Start time must be in the future' });
    }

    // Max 24 hours in advance
    if (start > now + 24 * 3600) {
      return res.status(400).json({ error: 'Cannot reserve more than 24 hours in advance' });
    }

    // 30 minute slots only
    const minutes = new Date(startTime).getMinutes();
    if (minutes !== 0 && minutes !== 30) {
      return res.status(400).json({ error: 'Reservations must start on the hour or half-hour' });
    }

    const end = start + 30 * 60; // 30 minutes

    // Check user doesn't have active reservation
    const hasActive = await db.hasActiveReservation(userId);
    if (hasActive) {
      return res.status(400).json({ error: 'You already have an active reservation' });
    }

    // Check for conflicts
    const conflicts = await db.getChargerReservations(chargerId, start, end);
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Time slot is already reserved' });
    }

    // Create reservation
    const reservation = await db.createReservation({
      userId,
      chargerId,
      startTime: start,
      endTime: end
    });

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation: {
        id: reservation.id,
        chargerId: reservation.chargerId,
        startTime: new Date(reservation.startTime * 1000).toISOString(),
        endTime: new Date(reservation.endTime * 1000).toISOString(),
        status: reservation.status
      }
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// Get user's reservations
router.get('/my', authenticate, async (req, res) => {
  try {
    const reservations = await db.getUserReservations(req.user.id);
    res.json(reservations.map(r => ({
      id: r.id,
      chargerId: r.charger_id,
      startTime: new Date(r.start_time * 1000).toISOString(),
      endTime: new Date(r.end_time * 1000).toISOString(),
      status: r.status,
      createdAt: new Date(r.created_at * 1000).toISOString()
    })));
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

// Cancel a reservation
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const cancelled = await db.cancelReservation(id, req.user.id);
    
    if (!cancelled) {
      return res.status(404).json({ error: 'Reservation not found or already cancelled' });
    }

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// Get available time slots for a charger (public)
router.get('/slots/:chargerId', async (req, res) => {
  try {
    const { chargerId } = req.params;
    const now = Math.floor(Date.now() / 1000);
    const endOfDay = now + 24 * 3600;

    // Get existing reservations
    const reservations = await db.getChargerReservations(chargerId, now, endOfDay);
    const reservedSlots = new Set();
    
    for (const r of reservations) {
      reservedSlots.add(r.start_time);
    }

    // Generate available slots (30 min increments for next 24h)
    const slots = [];
    const startOfNextHour = Math.ceil(now / 1800) * 1800;
    
    for (let t = startOfNextHour; t < endOfDay; t += 1800) {
      slots.push({
        time: new Date(t * 1000).toISOString(),
        available: !reservedSlots.has(t)
      });
    }

    res.json({ chargerId, slots });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Failed to get time slots' });
  }
});

// Admin: Get all reservations
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const reservations = await db.getAllReservations();
    res.json(reservations.map(r => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.email,
      userName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      chargerId: r.charger_id,
      startTime: new Date(r.start_time * 1000).toISOString(),
      endTime: new Date(r.end_time * 1000).toISOString(),
      status: r.status,
      createdAt: new Date(r.created_at * 1000).toISOString()
    })));
  } catch (error) {
    console.error('Get all reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

module.exports = router;
