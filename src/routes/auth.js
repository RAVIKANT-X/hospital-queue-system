const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const adminUsername = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUsername || !passwordHash || !/^\$2[aby]\$\d{2}\$/.test(passwordHash)) {
    return res.status(503).json({ message: 'Admin login is not configured' });
  }

  try {
    const secret = getJwtSecret();
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const passwordMatches = await bcrypt.compare(password, passwordHash);
    if (username !== adminUsername || !passwordMatches) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({}, secret, {
      algorithm: 'HS256',
      subject: adminUsername,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    return res.status(200).json({ token, token_type: 'Bearer' });
  } catch (error) {
    if (error.message.startsWith('JWT_SECRET')) {
      return res.status(503).json({ message: 'Admin login is not configured' });
    }
    console.error('Admin login failed:', error.message);
    return res.status(500).json({ message: 'Failed to authenticate admin' });
  }
});

module.exports = router;
