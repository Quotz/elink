/**
 * Notification Service
 * Handles push notifications and emails
 */

const db = require('./database');

// Mock wallet for MVP
const mockWallets = new Map();

class NotificationService {
  constructor() {
    this.emailEnabled = false;
    this.pushEnabled = false;
    this.sendgridKey = process.env.SENDGRID_API_KEY;
    this.firebaseKey = process.env.FIREBASE_SERVER_KEY;
  }

  // Initialize with API keys
  init() {
    if (this.sendgridKey) {
      this.emailEnabled = true;
      console.log('[Notifications] Email enabled (SendGrid)');
    }
    if (this.firebaseKey) {
      this.pushEnabled = true;
      console.log('[Notifications] Push enabled (FCM)');
    }
  }

  // Send push notification via FCM
  async sendPush(userId, { title, body, data = {} }) {
    if (!this.pushEnabled) {
      console.log('[Push] Would send to user', userId, ':', title, '-', body);
      return { success: true, mock: true };
    }

    try {
      const tokens = await db.getUserPushTokens(userId);
      if (tokens.length === 0) {
        return { success: false, error: 'No tokens found' };
      }

      const results = [];
      for (const { token } of tokens) {
        const result = await this.sendFCM(token, { title, body, data });
        results.push(result);
      }

      return { success: true, results };
    } catch (error) {
      console.error('[Push] Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send FCM message
  async sendFCM(token, { title, body, data }) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.firebaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
          data
        })
      });

      const result = await response.json();
      
      // Remove invalid tokens
      if (result.results && result.results[0]?.error === 'NotRegistered') {
        await db.deletePushToken(token);
      }

      return result;
    } catch (error) {
      console.error('[FCM] Error:', error);
      throw error;
    }
  }

  // Send email via SendGrid
  async sendEmail(to, { subject, text, html }) {
    if (!this.emailEnabled) {
      console.log('[Email] Would send to', to, ':', subject);
      return { success: true, mock: true };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.FROM_EMAIL || 'noreply@elink.mk' },
          subject,
          content: [
            { type: 'text/plain', value: text },
            ...(html ? [{ type: 'text/html', value: html }] : [])
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`SendGrid error: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error('[Email] Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Reservation confirmation
  async sendReservationConfirmation(userId, email, reservation) {
    const { id, chargerId, startTime } = reservation;
    
    const start = new Date(startTime).toLocaleString();
    const message = `Your reservation for charger ${chargerId} is confirmed for ${start}. Duration: 30 minutes.`;

    await this.sendPush(userId, {
      title: 'Reservation Confirmed',
      body: message,
      data: { type: 'reservation_confirmed', reservationId: id }
    });

    await this.sendEmail(email, {
      subject: 'eLink - Reservation Confirmed',
      text: message,
      html: `<p>${message}</p>`
    });
  }

  // Charging started notification
  async sendChargingStarted(userId, email, { chargerId, transactionId }) {
    const message = `Charging started at ${chargerId}.`;

    await this.sendPush(userId, {
      title: 'Charging Started',
      body: message,
      data: { type: 'charging_started', transactionId }
    });

    await this.sendEmail(email, {
      subject: 'eLink - Charging Started',
      text: message
    });
  }

  // Charging complete notification
  async sendChargingComplete(userId, email, { chargerId, kwh, cost }) {
    const message = `Charging complete! ${kwh.toFixed(2)} kWh delivered. Cost: €${cost.toFixed(2)}`;

    await this.sendPush(userId, {
      title: 'Charging Complete',
      body: message,
      data: { type: 'charging_complete', kwh, cost }
    });

    await this.sendEmail(email, {
      subject: 'eLink - Charging Complete',
      text: message,
      html: `<p>${message}</p><p>Thank you for using eLink!</p>`
    });
  }

  // Reservation reminder (call 15 min before)
  async sendReservationReminder(userId, email, { chargerId, startTime }) {
    const message = `Your reservation at ${chargerId} starts in 15 minutes.`;

    await this.sendPush(userId, {
      title: 'Reservation Reminder',
      body: message
    });
  }
}

// Mock Wallet Service for MVP
class WalletService {
  constructor() {
    // In-memory mock wallets
    this.wallets = new Map();
    this.transactions = [];
  }

  getBalance(userId) {
    return this.wallets.get(userId) || 0;
  }

  addFunds(userId, amount) {
    const current = this.getBalance(userId);
    this.wallets.set(userId, current + amount);
    
    this.transactions.push({
      id: Date.now().toString(),
      userId,
      type: 'topup',
      amount,
      timestamp: new Date().toISOString()
    });

    return this.getBalance(userId);
  }

  deductFunds(userId, amount) {
    const current = this.getBalance(userId);
    if (current < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    this.wallets.set(userId, current - amount);
    
    this.transactions.push({
      id: Date.now().toString(),
      userId,
      type: 'payment',
      amount: -amount,
      timestamp: new Date().toISOString()
    });

    return { success: true, balance: this.getBalance(userId) };
  }

  getTransactions(userId, limit = 20) {
    return this.transactions
      .filter(t => t.userId === userId)
      .slice(-limit)
      .reverse();
  }

  getAllTransactions(limit = 100) {
    return this.transactions.slice(-limit).reverse();
  }
}

module.exports = {
  notifications: new NotificationService(),
  wallet: new WalletService()
};
