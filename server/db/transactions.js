const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function createTransaction({ userId, chargerId, idTag, startMeter }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO transactions (id, user_id, charger_id, id_tag, start_time, start_meter, status)
       VALUES (?, ?, ?, ?, unixepoch(), ?, 'active')`,
      [id, userId, chargerId, idTag, startMeter],
      function(err) { if (err) reject(err); else resolve({ id, userId, chargerId, status: 'active' }); }
    );
  });
}

async function completeTransaction({ transactionId, endMeter, totalCost, status = 'completed' }) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE transactions SET end_time = unixepoch(), end_meter = ?, total_kwh = (end_meter - start_meter),
       total_cost = ?, status = ? WHERE id = ?`,
      [endMeter, totalCost, status, transactionId],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

async function getUserTransactions(userId, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit], (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

async function getUserChargingHistory(userId, limit = 50, offset = 0) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY start_time DESC LIMIT ? OFFSET ?',
      [userId, limit, offset], (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

async function getUserStats(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT COUNT(*) as totalSessions, COALESCE(SUM(total_kwh), 0) as totalEnergyKwh, COALESCE(SUM(total_cost), 0) as totalSpent, MAX(created_at) as lastSession FROM transactions WHERE user_id = ? AND status = "completed"',
      [userId],
      (err, row) => {
        if (err) { reject(err); return; }
        db.get(
          'SELECT charger_id, COUNT(*) as count FROM transactions WHERE user_id = ? GROUP BY charger_id ORDER BY count DESC LIMIT 1',
          [userId],
          (err2, favRow) => {
            if (err2) reject(err2);
            else resolve({ ...row, favoriteCharger: favRow ? favRow.charger_id : null });
          }
        );
      }
    );
  });
}

module.exports = { createTransaction, completeTransaction, getUserTransactions, getUserChargingHistory, getUserStats };
