try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch(e) {}

module.exports = {
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  DEMO_CHARGER_ID: '',
  DEMO_AWAIT_SECONDS: 20,
  DEFAULT_AWAIT_SECONDS: 30,
  USE_CITRINE_POLLING: process.env.USE_CITRINEOS === 'true',
  PORT: process.env.PORT || 3000
};
