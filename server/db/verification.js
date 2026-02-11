const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function createChargerOwner({ userId, chargerId, documents = [] }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO charger_owners (id, user_id, charger_id, verification_documents) VALUES (?, ?, ?, ?)`,
      [id, userId, chargerId, JSON.stringify(documents)],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) reject(new Error('User already owns this charger'));
          else reject(err);
        } else { resolve({ id, userId, chargerId, verified: false }); }
      }
    );
  });
}

async function getChargerOwner(chargerId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT co.*, u.email, u.first_name, u.last_name, u.phone FROM charger_owners co
       JOIN users u ON co.user_id = u.id WHERE co.charger_id = ?`,
      [chargerId], (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function verifyChargerOwner(chargerId, adminId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE charger_owners SET verified = 1, verified_at = unixepoch(), verified_by = ? WHERE charger_id = ?`,
      [adminId, chargerId],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

async function createChargerVerification({ chargerId, ownerId, serialNumber, manufacturer, model, installationAddress, electricalCertUrl, ownershipProofUrl }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO charger_verifications (id, charger_id, owner_id, serial_number, manufacturer, model, installation_address, electrical_cert_url, ownership_proof_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, chargerId, ownerId, serialNumber, manufacturer, model, installationAddress, electricalCertUrl, ownershipProofUrl],
      function(err) { if (err) reject(err); else resolve({ id, chargerId, status: 'pending' }); }
    );
  });
}

async function getChargerVerification(chargerId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT cv.*, u.email as owner_email, u.first_name, u.last_name FROM charger_verifications cv
       JOIN users u ON cv.owner_id = u.id WHERE cv.charger_id = ? ORDER BY cv.submitted_at DESC LIMIT 1`,
      [chargerId], (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function getPendingVerifications(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT cv.*, u.email as owner_email, u.first_name, u.last_name FROM charger_verifications cv
       JOIN users u ON cv.owner_id = u.id WHERE cv.status = 'pending' ORDER BY cv.submitted_at ASC LIMIT ?`,
      [limit], (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

async function updateVerificationStatus({ verificationId, status, adminId, rejectionReason, notes }) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE charger_verifications SET status = ?, reviewed_at = unixepoch(), reviewed_by = ?, rejection_reason = ?, notes = ? WHERE id = ?`,
      [status, adminId, rejectionReason, notes, verificationId],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

module.exports = {
  createChargerOwner, getChargerOwner, verifyChargerOwner,
  createChargerVerification, getChargerVerification, getPendingVerifications, updateVerificationStatus
};
