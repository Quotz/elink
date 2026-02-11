/**
 * Database facade - re-exports all domain modules
 * for backward compatibility with existing require('./database') calls.
 */

const db = require('./db/connection');

module.exports = {
  db,
  ...require('./db/users'),
  ...require('./db/sessions'),
  ...require('./db/transactions'),
  ...require('./db/reservations'),
  ...require('./db/wallet'),
  ...require('./db/notifications'),
  ...require('./db/verification'),
  ...require('./db/citrine'),
};
