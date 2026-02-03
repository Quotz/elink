const express = require('express');
const router = express.Router();
const { authenticateToken: authenticate } = require('../auth');
const { wallet } = require('../services');

// Get wallet balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const balance = wallet.getBalance(req.user.id);
    res.json({ 
      balance,
      currency: 'EUR'
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const transactions = wallet.getTransactions(req.user.id);
    res.json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Mock top-up (add funds)
router.post('/topup', authenticate, async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    if (!amount || amount < 5 || amount > 500) {
      return res.status(400).json({ error: 'Amount must be between €5 and €500' });
    }

    // In real implementation, this would integrate with Stripe/Adyen
    // For MVP, we just add the funds immediately
    const newBalance = wallet.addFunds(req.user.id, parseFloat(amount));

    res.json({
      message: 'Top-up successful',
      amount: parseFloat(amount),
      balance: newBalance,
      currency: 'EUR',
      transactionId: Date.now().toString(),
      // Mock payment details for UI
      paymentDetails: {
        method: paymentMethod || 'card',
        last4: '4242',
        brand: 'visa'
      }
    });
  } catch (error) {
    console.error('Top-up error:', error);
    res.status(500).json({ error: 'Failed to process top-up' });
  }
});

// Mock payment for charging (internal use)
router.post('/charge', authenticate, async (req, res) => {
  try {
    const { amount, transactionId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = wallet.deductFunds(req.user.id, parseFloat(amount));
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: 'Payment processed',
      amount: parseFloat(amount),
      balance: result.balance,
      transactionId
    });
  } catch (error) {
    console.error('Charge error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Admin: Get all transactions
router.get('/all-transactions', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const transactions = wallet.getAllTransactions();
    res.json({ transactions });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

module.exports = router;
