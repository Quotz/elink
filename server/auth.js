/**
 * Authentication middleware and JWT utilities
 */

const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[SECURITY] JWT_SECRET not set! Using fallback for development only.');
  // In production, this should throw an error
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
}
const FINAL_JWT_SECRET = JWT_SECRET || 'elink-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Generate tokens
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, FINAL_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, FINAL_JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  
  return { accessToken, refreshToken };
}

// Verify access token
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, FINAL_JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Verify refresh token
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, FINAL_JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Get user from database
  const user = await db.getUserById(decoded.userId);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  // Attach user to request
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: !!user.email_verified,
    phoneVerified: !!user.phone_verified,
    firstName: user.first_name,
    lastName: user.last_name
  };

  next();
}

// Role-based authorization middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Optional auth middleware (attaches user if token valid, but doesn't require it)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      const user = await db.getUserById(decoded.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: !!user.email_verified,
          phoneVerified: !!user.phone_verified,
          firstName: user.first_name,
          lastName: user.last_name
        };
      }
    }
  }

  next();
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  authenticateToken,
  requireRole,
  optionalAuth,
  JWT_SECRET,
  REFRESH_TOKEN_EXPIRES_MS
};
