const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function savePushToken({ userId, token, platform = 'web' }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO push_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, token) DO UPDATE SET platform = excluded.platform`,
      [id, userId, token, platform],
      function(err) { if (err) reject(err); else resolve({ id, userId, token, platform }); }
    );
  });
}

async function getUserPushTokens(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM push_tokens WHERE user_id = ?', [userId],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

async function deletePushToken(token) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM push_tokens WHERE token = ?', [token],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

module.exports = { savePushToken, getUserPushTokens, deletePushToken };
