const jwt = require('jsonwebtoken');

const JWT_ISSUER = 'carepoint-api';
const JWT_AUDIENCE = 'carepoint-admin';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }
  return secret;
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(match[1], getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    if (typeof payload !== 'object' || payload.sub !== process.env.ADMIN_USERNAME) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    return next();
  } catch (error) {
    if (error.message.startsWith('JWT_SECRET')) {
      return res.status(503).json({ message: 'Authentication is not configured' });
    }
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = {
  JWT_AUDIENCE,
  JWT_ISSUER,
  getJwtSecret,
  requireAuth
};
