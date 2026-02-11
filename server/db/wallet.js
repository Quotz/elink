const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function getWalletBalance(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT balance FROM wallet_balances WHERE user_id = ?', [userId],
      (err, row) => { if (err) reject(err); else resolve(row ? row.balance : 0); }
    );
  });
}

async function addWalletFunds(userId, amount) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO wallet_balances (user_id, balance, updated_at) VALUES (?, ?, unixepoch())
       ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = unixepoch()`,
      [userId, amount, amount],
      (err) => {
        if (err) return reject(err);
        db.run(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, description) VALUES (?, ?, 'topup', ?, 'Wallet top-up')`,
          [id, userId, amount],
          (err2) => {
            if (err2) return reject(err2);
            db.get('SELECT balance FROM wallet_balances WHERE user_id = ?', [userId],
              (err3, row) => { if (err3) reject(err3); else resolve(row.balance); }
            );
          }
        );
      }
    );
  });
}

async function deductWalletFunds(userId, amount, description = 'Charging payment') {
  return new Promise((resolve, reject) => {
    db.get('SELECT balance FROM wallet_balances WHERE user_id = ?', [userId],
      (err, row) => {
        if (err) return reject(err);
        const balance = row ? row.balance : 0;
        if (balance < amount) return resolve({ success: false, error: 'Insufficient balance' });
        const id = uuidv4();
        db.run(
          `UPDATE wallet_balances SET balance = balance - ?, updated_at = unixepoch() WHERE user_id = ?`,
          [amount, userId],
          (err2) => {
            if (err2) return reject(err2);
            db.run(
              `INSERT INTO wallet_transactions (id, user_id, type, amount, description) VALUES (?, ?, 'payment', ?, ?)`,
              [id, userId, -amount, description],
              (err3) => { if (err3) return reject(err3); resolve({ success: true, balance: balance - amount }); }
            );
          }
        );
      }
    );
  });
}

async function getWalletTransactions(userId, limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit], (err, rows) => { if (err) reject(err); else resolve(rows || []); }
    );
  });
}

async function getAllWalletTransactions(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT wt.*, u.email, u.first_name, u.last_name FROM wallet_transactions wt
       JOIN users u ON wt.user_id = u.id ORDER BY wt.created_at DESC LIMIT ?`,
      [limit], (err, rows) => { if (err) reject(err); else resolve(rows || []); }
    );
  });
}

module.exports = { getWalletBalance, addWalletFunds, deductWalletFunds, getWalletTransactions, getAllWalletTransactions };
