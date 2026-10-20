
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

console.log('Appointments router loaded');

// POST /api/appointments
router.post('/', async (req, res) => {
  const { patient_id, doctor_id, appointment_time } = req.body;

  const patientId = Number(patient_id);
  const doctorId = Number(doctor_id);
  const time = new Date(appointment_time);

  if (
    !Number.isInteger(patientId) || patientId <= 0 ||
    !Number.isInteger(doctorId) || doctorId <= 0 ||
    typeof appointment_time !== 'string' ||
    !appointment_time.trim() ||
    Number.isNaN(time.getTime())
  ) {
    return res.status(400).json({
      message: 'Valid patient_id, doctor_id and appointment_time are required'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_time)
       VALUES ($1, $2, $3)
       RETURNING id, patient_id, doctor_id,
                 appointment_time, status, created_at`,
      [patientId, doctorId, time.toISOString()]
    );

    return res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'This doctor already has an appointment at that time'
      });
    }

    if (error.code === '23503') {
      return res.status(400).json({
        message: 'Patient or doctor does not exist'
      });
    }

    console.error('Appointment booking failed:', error.message);
    return res.status(500).json({
      message: 'Failed to book appointment'
    });
  }
});

module.exports = router;
