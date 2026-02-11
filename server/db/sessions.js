const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function createSession({ userId, refreshToken, expiresAt, ipAddress, userAgent }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO user_sessions (id, user_id, refresh_token, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, refreshToken, expiresAt, ipAddress, userAgent],
      function(err) { if (err) reject(err); else resolve({ id, userId, refreshToken, expiresAt }); }
    );
  });
}

async function getSessionByRefreshToken(token) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM user_sessions WHERE refresh_token = ? AND revoked = 0 AND expires_at > ?',
      [token, Date.now()],
      (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function revokeSession(token) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE user_sessions SET revoked = 1 WHERE refresh_token = ?', [token],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

async function revokeAllUserSessions(userId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE user_sessions SET revoked = 1 WHERE user_id = ?', [userId],
      function(err) { if (err) reject(err); else resolve(this.changes); }
    );
  });
}

module.exports = { createSession, getSessionByRefreshToken, revokeSession, revokeAllUserSessions };
