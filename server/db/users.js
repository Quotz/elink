const db = require('./connection');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createUser({ email, password, phone, firstName, lastName, role = 'driver' }) {
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = uuidv4();

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (id, email, phone, password_hash, role, first_name, last_name, verification_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email, phone, passwordHash, role, firstName, lastName, verificationToken],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Email or phone already registered'));
          } else { reject(err); }
        } else {
          resolve({ id, email, phone, role, firstName, lastName, verificationToken });
        }
      }
    );
  });
}

async function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

async function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

async function verifyUser(token) {
  return new Promise((resolve, reject) => {
    db.get(
      `UPDATE users SET email_verified = 1, verification_token = NULL, updated_at = unixepoch()
       WHERE verification_token = ? RETURNING id, email, email_verified`,
      [token], (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function createPasswordResetToken(email) {
  const token = uuidv4();
  const expiresAt = Date.now() + 3600000;
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET reset_token = ?, reset_token_expires = ?, updated_at = unixepoch() WHERE email = ?`,
      [token, expiresAt, email],
      function(err) { if (err) reject(err); else resolve(this.changes > 0 ? token : null); }
    );
  });
}

async function resetPassword(token, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = unixepoch()
       WHERE reset_token = ? AND reset_token_expires > ?`,
      [passwordHash, token, Date.now()],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

async function validatePassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

async function updateUserProfile(userId, { firstName, lastName, phone }) {
  return new Promise((resolve, reject) => {
    const updates = [];
    const params = [];
    if (firstName !== undefined) { updates.push('first_name = ?'); params.push(firstName); }
    if (lastName !== undefined) { updates.push('last_name = ?'); params.push(lastName); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    updates.push('updated_at = unixepoch()');
    params.push(userId);
    db.get('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ? RETURNING *', params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

async function getAllUsers(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, email, phone, role, first_name, last_name, email_verified, created_at
       FROM users ORDER BY created_at DESC LIMIT ?`,
      [limit], (err, rows) => { if (err) reject(err); else resolve(rows || []); }
    );
  });
}

module.exports = {
  createUser, getUserByEmail, getUserById, verifyUser,
  createPasswordResetToken, resetPassword, validatePassword,
  updateUserProfile, getAllUsers
};
