
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/doctors
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, specialty, created_at FROM doctors ORDER BY id'
    );

    res.status(200).json({
      count: result.rows.length,
      doctors: result.rows
    });
  } catch (error) {
    console.error('Error fetching doctors:', error.message);

    res.status(500).json({
      message: 'Failed to fetch doctors'
    });
  }
});

module.exports = router;
