
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res) => {
  const email = req.query.email;

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      message: 'A valid email is required'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, created_at
       FROM patients
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Patient not found'
      });
    }

    return res.status(200).json({
      patient: result.rows[0]
    });
  } catch (error) {
    console.error('Patient lookup failed:', error.message);
    return res.status(500).json({
      message: 'Failed to find patient'
    });
  }
});

router.post('/', async (req, res) => {
  const { name, email } = req.body;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      message: 'A valid name and email are required'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO patients (name, email)
       VALUES ($1, $2)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.trim().toLowerCase()]
    );

    res.status(201).json({
      message: 'Patient registered successfully',
      patient: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'This email is already registered'
      });
    }

    console.error('Patient registration failed:', error.message);
    res.status(500).json({
      message: 'Failed to register patient'
    });
  }
});

module.exports = router;
