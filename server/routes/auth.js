/**
 * Authentication routes
 * Registration, login, verification, password reset
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateTokens, verifyRefreshToken, authenticateToken, REFRESH_TOKEN_EXPIRES_MS } = require('../auth');

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password validation - min 8 chars, at least 1 letter and 1 number
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

// Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, phone, firstName, lastName, role = 'driver' } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with at least one letter and one number' 
      });
    }

    if (role && !['driver', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be driver or owner' });
    }

    // Create user
    const user = await db.createUser({
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim(),
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      role
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Store refresh token
    await db.createSession({
      userId: user.id,
      refreshToken,
      expiresAt: Date.now() + REFRESH_TOKEN_EXPIRES_MS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // TODO: Send verification email
    console.log(`[Auth] User registered: ${user.email}, verification token: ${user.verificationToken}`);

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: false
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    if (error.message === 'Email or phone already registered') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const user = await db.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate password
    const validPassword = await db.validatePassword(user, password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Store refresh token
    await db.createSession({
      userId: user.id,
      refreshToken,
      expiresAt: Date.now() + REFRESH_TOKEN_EXPIRES_MS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: !!user.email_verified,
        phoneVerified: !!user.phone_verified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify token format
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database and is not revoked
    const session = await db.getSessionByRefreshToken(refreshToken);
    if (!session) {
      return res.status(403).json({ error: 'Refresh token revoked or expired' });
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId);
    
    // Revoke old session and create new one
    await db.revokeSession(refreshToken);
    await db.createSession({
      userId: decoded.userId,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + REFRESH_TOKEN_EXPIRES_MS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await db.revokeSession(refreshToken);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Logout all sessions (requires auth)
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    await db.revokeAllUserSessions(req.user.id);
    res.json({ message: 'All sessions logged out' });
  } catch (error) {
    console.error('[Auth] Logout all error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Email verification
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const user = await db.verifyUser(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    res.json({ 
      message: 'Email verified successfully',
      email: user.email
    });
  } catch (error) {
    console.error('[Auth] Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await db.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: 'If the email exists, a verification link has been sent' });
    }

    if (user.email_verified) {
      return res.json({ message: 'Email already verified' });
    }

    // TODO: Send verification email with user.verification_token
    console.log(`[Auth] Resend verification: ${user.email}, token: ${user.verification_token}`);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('[Auth] Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const token = await db.createPasswordResetToken(email.toLowerCase().trim());
    
    if (token) {
      // TODO: Send password reset email
      console.log(`[Auth] Password reset requested: ${email}, token: ${token}`);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If the email exists, a password reset link has been sent' });
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with at least one letter and one number' 
      });
    }

    const success = await db.resetPassword(token, newPassword);
    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Get current user (requires auth)
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// Change password (requires auth)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with at least one letter and one number' 
      });
    }

    // Get full user record with password hash
    const user = await db.getUserById(req.user.id);
    
    // Verify current password
    const validPassword = await db.validatePassword(user, currentPassword);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password (create a temporary reset token flow)
    const resetToken = await db.createPasswordResetToken(user.email);
    await db.resetPassword(resetToken, newPassword);

    // Revoke all sessions except current
    await db.revokeAllUserSessions(req.user.id);

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    console.error('[Auth] Change password error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;
