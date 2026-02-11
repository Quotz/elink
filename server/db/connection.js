const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'elink.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Initialize schema
db.exec(`
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

  CREATE TABLE IF NOT EXISTS charger_owners (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    charger_id TEXT NOT NULL,
    verified BOOLEAN DEFAULT 0,
    verification_documents TEXT,
    submitted_at INTEGER DEFAULT (unixepoch()),
    verified_at INTEGER,
    verified_by TEXT,
    rejection_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, charger_id)
  );

  CREATE INDEX IF NOT EXISTS idx_charger_owners_user ON charger_owners(user_id);
  CREATE INDEX IF NOT EXISTS idx_charger_owners_charger ON charger_owners(charger_id);

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

  CREATE TABLE IF NOT EXISTS wallet_balances (
    user_id TEXT PRIMARY KEY,
    balance REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('topup', 'payment', 'refund')),
    amount REAL NOT NULL,
    description TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
`);

// Seed default admin account
db.get('SELECT id FROM users WHERE email = ?', ['admin'], (err, row) => {
  if (err) { console.error('[DB] Error checking admin:', err); return; }
  if (!row) {
    const passwordHash = bcrypt.hashSync('admin', 10);
    db.run(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name, email_verified)
       VALUES (?, ?, ?, 'admin', 'Admin', 'eLink', 1)`,
      ['admin-default', 'admin', passwordHash],
      (err) => {
        if (err && !err.message.includes('UNIQUE constraint')) {
          console.error('[DB] Error creating admin:', err);
        } else if (!err) {
          console.log('[DB] Default admin account created (admin/admin)');
        }
      }
    );
  }
});

module.exports = db;
