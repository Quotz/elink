const db = require('./connection');
const { v4: uuidv4 } = require('uuid');

async function createCitrineMapping({ elinkChargerId, citrineChargerId, citrineLocationId }) {
  const id = uuidv4();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO citrine_mappings (id, elink_charger_id, citrine_charger_id, citrine_location_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(elink_charger_id) DO UPDATE SET
         citrine_charger_id = excluded.citrine_charger_id,
         citrine_location_id = excluded.citrine_location_id,
         last_sync_at = unixepoch()`,
      [id, elinkChargerId, citrineChargerId, citrineLocationId],
      function(err) { if (err) reject(err); else resolve({ id, elinkChargerId, citrineChargerId }); }
    );
  });
}

async function getCitrineMapping(elinkChargerId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM citrine_mappings WHERE elink_charger_id = ?', [elinkChargerId],
      (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

async function updateLastSync(elinkChargerId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE citrine_mappings SET last_sync_at = unixepoch() WHERE elink_charger_id = ?', [elinkChargerId],
      function(err) { if (err) reject(err); else resolve(this.changes > 0); }
    );
  });
}

module.exports = { createCitrineMapping, getCitrineMapping, updateLastSync };
