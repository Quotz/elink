const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function createReservation({ userId, chargerId, startTime, endTime }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO reservations (id, user_id, charger_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [id, userId, chargerId, startTime, endTime],
      function(err) { if (err) reject(err); else resolve({ id, userId, chargerId, startTime, endTime, status: 'active' }); }
    );
  });
}

async function getReservationById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT r.*, u.email, u.first_name, u.last_name FROM reservations r JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
      [id], (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function getUserReservations(userId, activeOnly = false) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT r.* FROM reservations r WHERE r.user_id = ?`;
    if (activeOnly) sql += ` AND r.status = 'active' AND r.end_time > unixepoch()`;
    sql += ` ORDER BY r.start_time DESC`;
    db.all(sql, [userId], (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

async function getChargerReservations(chargerId, startTime, endTime) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM reservations WHERE charger_id = ? AND status = 'active'
       AND ((start_time <= ? AND end_time >= ?) OR (start_time >= ? AND start_time < ?))
       ORDER BY start_time`,
      [chargerId, endTime, startTime, startTime, endTime],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

async function cancelReservation(id, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE reservations SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'active'`,
      [id, userId],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

async function getRecentReservation(userId, sinceTimestamp) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM reservations WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1`,
      [userId, sinceTimestamp],
      (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function hasActiveReservation(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM reservations WHERE user_id = ? AND status = 'active' AND end_time > unixepoch()`,
      [userId],
      (err, row) => { if (err) reject(err); else resolve(row.count > 0); }
    );
  });
}

async function getAllReservations(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT r.*, u.email, u.first_name, u.last_name FROM reservations r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT ?`,
      [limit], (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

module.exports = {
  createReservation, getReservationById, getUserReservations, getChargerReservations,
  cancelReservation, getRecentReservation, hasActiveReservation, getAllReservations
};
