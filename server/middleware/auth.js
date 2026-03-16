const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'chiboubroll-secret-change-me';

/**
 * Middleware to verify JWT from Authorization header.
 * Sets req.userId on success.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

/**
 * Generate a JWT for a given user ID.
 */
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authMiddleware, generateToken };
