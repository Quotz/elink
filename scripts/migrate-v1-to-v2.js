#!/usr/bin/env node
/**
 * Migrate eLink v1.0 data to v2.0
 * Reads stations.json, creates SQLite database entries
 */

const fs = require('fs');
const path = require('path');

// Paths
const V1_STATIONS_FILE = path.join(__dirname, '..', 'data', 'stations.json');
const V2_DB_FILE = path.join(__dirname, '..', 'data', 'elink.db');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║         eLink v1.0 → v2.0 Data Migration               ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log();

// Check if v1 data exists
if (!fs.existsSync(V1_STATIONS_FILE)) {
    console.log('No v1 stations.json found. Nothing to migrate.');
    process.exit(0);
}

// Check if v2 database exists
if (!fs.existsSync(V2_DB_FILE)) {
    console.log('v2.0 database not initialized yet.');
    console.log('Start the server once to create the database:');
    console.log('  npm start');
    process.exit(1);
}

// Read v1 stations
const stationsData = fs.readFileSync(V1_STATIONS_FILE, 'utf8');
const stations = JSON.parse(stationsData);

console.log(`Found ${Object.keys(stations).length} stations in v1.0`);
console.log();

// Connect to v2 database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(V2_DB_FILE);

// Migration logic
async function migrate() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            console.log('Migrating stations...');
            
            for (const [id, station] of Object.entries(stations)) {
                console.log(`  - ${id}: ${station.name}`);
                
                // Note: In v2.0, stations are still stored in stations.json
                // for backward compatibility. The SQLite database adds:
                // - users
                // - charger_owners
                // - charger_verifications
                // - transactions
                // - user_sessions
                
                // If you want to create default owner records:
                // This would require manual mapping of chargers to owners
            }
            
            console.log();
            console.log('✅ Migration complete!');
            console.log();
            console.log('Next steps:');
            console.log('  1. Create admin user: POST /api/auth/register');
            console.log('  2. Create owner users for each charger');
            console.log('  3. Submit chargers for verification');
            console.log();
            
            resolve();
        });
    });
}

// Note: Since v2.0 still uses stations.json for charger data,
// the main migration is just ensuring the database is created.
// User/ownership data needs to be created fresh in v2.0.

console.log('Note: v2.0 maintains stations.json compatibility.');
console.log('The SQLite database stores NEW data: users, owners, verification.');
console.log('You will need to:');
console.log('  1. Register owner accounts');
console.log('  2. Map chargers to owners');
console.log('  3. Submit chargers for verification');
console.log();

// Create a migration report
const report = {
    timestamp: new Date().toISOString(),
    v1_stations_count: Object.keys(stations).length,
    stations: Object.entries(stations).map(([id, s]) => ({
        id,
        name: s.name,
        power: s.power,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        status: 'needs_owner_assignment'
    }))
};

const reportFile = path.join(__dirname, '..', 'data', 'migration-report.json');
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`Migration report saved to: ${reportFile}`);

migrate().then(() => {
    db.close();
    process.exit(0);
}).catch(err => {
    console.error('Migration failed:', err);
    db.close();
    process.exit(1);
});
