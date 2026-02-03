/**
 * Database module for eLink
 * SQLite for users, sessions, transactions, and verification records
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'elink.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.init();
  }

  init() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'driver' CHECK(role IN ('driver', 'owner', 'admin')),
        first_name TEXT,
        last_name TEXT,
        email_verified BOOLEAN DEFAULT 0,
        phone_verified BOOLEAN DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expires INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

      -- Charger ownership table
      CREATE TABLE IF NOT EXISTS charger_owners (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        charger_id TEXT NOT NULL,
        verified BOOLEAN DEFAULT 0,
        verification_documents TEXT, -- JSON array of document URLs
        submitted_at INTEGER DEFAULT (unixepoch()),
        verified_at INTEGER,
        verified_by TEXT,
        rejection_reason TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, charger_id)
      );

      CREATE INDEX IF NOT EXISTS idx_charger_owners_user ON charger_owners(user_id);
      CREATE INDEX IF NOT EXISTS idx_charger_owners_charger ON charger_owners(charger_id);

      -- Charger verification requests
      CREATE TABLE IF NOT EXISTS charger_verifications (
        id TEXT PRIMARY KEY,
        charger_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        serial_number TEXT,
        manufacturer TEXT,
        model TEXT,
        installation_address TEXT,
        electrical_cert_url TEXT,
        ownership_proof_url TEXT,
        submitted_at INTEGER DEFAULT (unixepoch()),
        reviewed_at INTEGER,
        reviewed_by TEXT,
        rejection_reason TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_charger_verifications_charger ON charger_verifications(charger_id);
      CREATE INDEX IF NOT EXISTS idx_charger_verifications_status ON charger_verifications(status);

      -- User sessions for refresh tokens
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        ip_address TEXT,
        user_agent TEXT,
        revoked BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON user_sessions(refresh_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

      -- Transaction history
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        charger_id TEXT NOT NULL,
        id_tag TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        start_meter REAL,
        end_meter REAL,
        total_kwh REAL,
        total_cost REAL,
        currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed')),
        payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'refunded', 'failed')),
        payment_method TEXT,
        external_transaction_id TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_charger ON transactions(charger_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

      -- CitrineOS integration mappings
      CREATE TABLE IF NOT EXISTS citrine_mappings (
        id TEXT PRIMARY KEY,
        elink_charger_id TEXT UNIQUE NOT NULL,
        citrine_charger_id TEXT,
        citrine_location_id TEXT,
        sync_enabled BOOLEAN DEFAULT 1,
        last_sync_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_citrine_elink ON citrine_mappings(elink_charger_id);

      -- Reservations table
      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        charger_id TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled', 'expired')),
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_charger ON reservations(charger_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(start_time, end_time);
      CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

      -- User push notification tokens
      CREATE TABLE IF NOT EXISTS push_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        platform TEXT DEFAULT 'web' CHECK(platform IN ('web', 'android', 'ios')),
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, token)
      );

      CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
    `);
  }

  // User methods
  async createUser({ email, password, phone, firstName, lastName, role = 'driver' }) {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO users (id, email, phone, password_hash, role, first_name, last_name, verification_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(sql, [id, email, phone, passwordHash, role, firstName, lastName, verificationToken], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Email or phone already registered'));
          } else {
            reject(err);
          }
        } else {
          resolve({ id, email, phone, role, firstName, lastName, verificationToken });
        }
      });
    });
  }

  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async verifyUser(token) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users 
        SET email_verified = 1, verification_token = NULL, updated_at = unixepoch()
        WHERE verification_token = ?
        RETURNING id, email, email_verified
      `;
      this.db.get(sql, [token], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createPasswordResetToken(email) {
    const token = uuidv4();
    const expiresAt = Date.now() + 3600000; // 1 hour

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users 
        SET reset_token = ?, reset_token_expires = ?, updated_at = unixepoch()
        WHERE email = ?
      `;
      this.db.run(sql, [token, expiresAt, email], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0 ? token : null);
      });
    });
  }

  async resetPassword(token, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users 
        SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = unixepoch()
        WHERE reset_token = ? AND reset_token_expires > ?
      `;
      this.db.run(sql, [passwordHash, token, Date.now()], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async validatePassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  }

  // Session methods
  async createSession({ userId, refreshToken, expiresAt, ipAddress, userAgent }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO user_sessions (id, user_id, refresh_token, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      this.db.run(sql, [id, userId, refreshToken, expiresAt, ipAddress, userAgent], function(err) {
        if (err) reject(err);
        else resolve({ id, userId, refreshToken, expiresAt });
      });
    });
  }

  async getSessionByRefreshToken(token) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM user_sessions WHERE refresh_token = ? AND revoked = 0 AND expires_at > ?',
        [token, Date.now()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async revokeSession(token) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE user_sessions SET revoked = 1 WHERE refresh_token = ?',
        [token],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  async revokeAllUserSessions(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE user_sessions SET revoked = 1 WHERE user_id = ?',
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // Charger ownership methods
  async createChargerOwner({ userId, chargerId, documents = [] }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO charger_owners (id, user_id, charger_id, verification_documents)
        VALUES (?, ?, ?, ?)
      `;
      this.db.run(sql, [id, userId, chargerId, JSON.stringify(documents)], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('User already owns this charger'));
          } else {
            reject(err);
          }
        } else {
          resolve({ id, userId, chargerId, verified: false });
        }
      });
    });
  }

  async getChargerOwner(chargerId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT co.*, u.email, u.first_name, u.last_name, u.phone 
         FROM charger_owners co
         JOIN users u ON co.user_id = u.id
         WHERE co.charger_id = ?`,
        [chargerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async verifyChargerOwner(chargerId, adminId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE charger_owners 
        SET verified = 1, verified_at = unixepoch(), verified_by = ?
        WHERE charger_id = ?
      `;
      this.db.run(sql, [adminId, chargerId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // Charger verification methods
  async createChargerVerification({ chargerId, ownerId, serialNumber, manufacturer, model, installationAddress, electricalCertUrl, ownershipProofUrl }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO charger_verifications 
        (id, charger_id, owner_id, serial_number, manufacturer, model, installation_address, electrical_cert_url, ownership_proof_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      this.db.run(sql, [id, chargerId, ownerId, serialNumber, manufacturer, model, installationAddress, electricalCertUrl, ownershipProofUrl], function(err) {
        if (err) reject(err);
        else resolve({ id, chargerId, status: 'pending' });
      });
    });
  }

  async getChargerVerification(chargerId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT cv.*, u.email as owner_email, u.first_name, u.last_name
         FROM charger_verifications cv
         JOIN users u ON cv.owner_id = u.id
         WHERE cv.charger_id = ?
         ORDER BY cv.submitted_at DESC LIMIT 1`,
        [chargerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getPendingVerifications(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT cv.*, u.email as owner_email, u.first_name, u.last_name
         FROM charger_verifications cv
         JOIN users u ON cv.owner_id = u.id
         WHERE cv.status = 'pending'
         ORDER BY cv.submitted_at ASC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async updateVerificationStatus({ verificationId, status, adminId, rejectionReason, notes }) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE charger_verifications 
        SET status = ?, reviewed_at = unixepoch(), reviewed_by = ?, rejection_reason = ?, notes = ?
        WHERE id = ?
      `;
      this.db.run(sql, [status, adminId, rejectionReason, notes, verificationId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  // Transaction methods
  async createTransaction({ userId, chargerId, idTag, startMeter }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO transactions (id, user_id, charger_id, id_tag, start_time, start_meter, status)
        VALUES (?, ?, ?, ?, unixepoch(), ?, 'active')
      `;
      this.db.run(sql, [id, userId, chargerId, idTag, startMeter], function(err) {
        if (err) reject(err);
        else resolve({ id, userId, chargerId, status: 'active' });
      });
    });
  }

  async completeTransaction({ transactionId, endMeter, totalCost, status = 'completed' }) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE transactions 
        SET end_time = unixepoch(), end_meter = ?, total_kwh = (end_meter - start_meter), 
            total_cost = ?, status = ?
        WHERE id = ?
      `;
      this.db.run(sql, [endMeter, totalCost, status, transactionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async getUserTransactions(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // CitrineOS integration methods
  async createCitrineMapping({ elinkChargerId, citrineChargerId, citrineLocationId }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO citrine_mappings (id, elink_charger_id, citrine_charger_id, citrine_location_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(elink_charger_id) DO UPDATE SET
          citrine_charger_id = excluded.citrine_charger_id,
          citrine_location_id = excluded.citrine_location_id,
          last_sync_at = unixepoch()
      `;
      this.db.run(sql, [id, elinkChargerId, citrineChargerId, citrineLocationId], function(err) {
        if (err) reject(err);
        else resolve({ id, elinkChargerId, citrineChargerId });
      });
    });
  }

  async getCitrineMapping(elinkChargerId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM citrine_mappings WHERE elink_charger_id = ?',
        [elinkChargerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async updateLastSync(elinkChargerId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE citrine_mappings SET last_sync_at = unixepoch() WHERE elink_charger_id = ?',
        [elinkChargerId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  // Reservation methods
  async createReservation({ userId, chargerId, startTime, endTime }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO reservations (id, user_id, charger_id, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `;
      this.db.run(sql, [id, userId, chargerId, startTime, endTime], function(err) {
        if (err) reject(err);
        else resolve({ id, userId, chargerId, startTime, endTime, status: 'active' });
      });
    });
  }

  async getReservationById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT r.*, u.email, u.first_name, u.last_name
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         WHERE r.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getUserReservations(userId, activeOnly = false) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT r.*, 
               (SELECT name FROM json_each(
                 (SELECT json_array(json_object('id', id, 'name', name)) 
                  FROM (SELECT id, name FROM stations WHERE id = r.charger_id))
               )) as charger_name
        FROM reservations r
        WHERE r.user_id = ?
      `;
      if (activeOnly) {
        sql += ` AND r.status = 'active' AND r.end_time > unixepoch()`;
      }
      sql += ` ORDER BY r.start_time DESC`;
      
      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getChargerReservations(chargerId, startTime, endTime) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM reservations 
         WHERE charger_id = ? 
         AND status = 'active'
         AND ((start_time <= ? AND end_time >= ?) OR (start_time >= ? AND start_time < ?))
         ORDER BY start_time`,
        [chargerId, endTime, startTime, startTime, endTime],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async cancelReservation(id, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE reservations SET status = 'cancelled' 
         WHERE id = ? AND user_id = ? AND status = 'active'`,
        [id, userId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  async hasActiveReservation(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT COUNT(*) as count FROM reservations 
         WHERE user_id = ? AND status = 'active' AND end_time > unixepoch()`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count > 0);
        }
      );
    });
  }

  async getAllReservations(limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT r.*, u.email, u.first_name, u.last_name
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Push token methods
  async savePushToken({ userId, token, platform = 'web' }) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO push_tokens (id, user_id, token, platform)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, token) DO UPDATE SET
          platform = excluded.platform
      `;
      this.db.run(sql, [id, userId, token, platform], function(err) {
        if (err) reject(err);
        else resolve({ id, userId, token, platform });
      });
    });
  }

  async getUserPushTokens(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM push_tokens WHERE user_id = ?',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async deletePushToken(token) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM push_tokens WHERE token = ?',
        [token],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }
}

module.exports = new Database();
