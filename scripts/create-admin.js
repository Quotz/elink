const db = require('../server/database');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    // Check if exists
    const existing = await db.getUserByEmail('adminelink');
    if (existing) {
      console.log('Admin already exists');
      // Update password and role
      const passwordHash = bcrypt.hashSync('Andrejkocevski123%', 10);
      await new Promise((resolve, reject) => {
        db.db.run(
          "UPDATE users SET role='admin', password_hash=? WHERE email='adminelink'",
          [passwordHash],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log('Updated admin password and role');
      return;
    }
    
    // Create admin
    const id = 'admin-001';
    const passwordHash = bcrypt.hashSync('Andrejkocevski123%', 10);
    
    await new Promise((resolve, reject) => {
      db.db.run(
        "INSERT INTO users (id, email, password_hash, role, first_name, last_name, email_verified) VALUES (?, ?, ?, 'admin', 'Admin', 'eLink', 1)",
        [id, 'adminelink', passwordHash],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log('Admin created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

createAdmin();
