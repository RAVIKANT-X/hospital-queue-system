
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// POST /api/appointments
// Book a new appointment
router.post('/', async (req, res) => {
  const { patient_id, doctor_id, appointment_time } = req.body;

  const patientId = Number(patient_id);
  const doctorId = Number(doctor_id);
  const time = new Date(appointment_time);

  // Validate request data
  if (
    !Number.isInteger(patientId) || patientId <= 0 ||
    !Number.isInteger(doctorId) || doctorId <= 0 ||
    typeof appointment_time !== 'string' ||
    !appointment_time.trim() ||
    Number.isNaN(time.getTime())
  ) {
    return res.status(400).json({
      message:
        'Valid patient_id, doctor_id and appointment_time are required'
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
    // Doctor already has an appointment at this time
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'This doctor already has an appointment at that time'
      });
    }

    // Patient or doctor ID does not exist
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

// PATCH /api/appointments/:id/cancel
// Cancel an existing appointment without deleting its record
router.patch('/:id/cancel', async (req, res) => {
  const appointmentId = Number(req.params.id);

  // Validate appointment ID
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({
      message: 'A valid appointment ID is required'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE appointments
       SET status = 'cancelled'
       WHERE id = $1 AND status = 'booked'
       RETURNING id, patient_id, doctor_id,
                 appointment_time, status, created_at`,
      [appointmentId]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        'SELECT id, status FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          message: 'Appointment not found'
        });
      }

      return res.status(409).json({
        message: `Appointment cannot be cancelled because its status is '${existing.rows[0].status}'`
      });
    }

    return res.status(200).json({
      message: 'Appointment cancelled successfully',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Appointment cancellation failed:', error.message);

    return res.status(500).json({
      message: 'Failed to cancel appointment'
    });
  }
});


router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         a.id,
         p.name AS patient_name,
         d.name AS doctor_name,
         d.specialty,
         a.appointment_time,
         a.status
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       ORDER BY a.appointment_time ASC`
    );

    return res.status(200).json({
      count: result.rows.length,
      appointments: result.rows
    });

  } catch (error) {
    console.error('Failed to fetch appointments:', error.message);

    return res.status(500).json({
      message: 'Failed to retrieve appointments'
    });
  }
});


router.get('/:id', async (req, res) => {
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return res.status(400).json({
      message: 'A valid appointment ID is required'
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         a.id,
         p.name AS patient_name,
         d.name AS doctor_name,
         d.specialty,
         a.appointment_time,
         a.status
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id
       INNER JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    return res.status(200).json({
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error('Failed to fetch appointment:', error.message);

    return res.status(500).json({
      message: 'Failed to retrieve appointment'
    });
  }
});


module.exports = router;
