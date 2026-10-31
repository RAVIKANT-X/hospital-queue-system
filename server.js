


const express = require('express');
const cors = require('cors');
const pool = require('./src/config/db');
const doctorsRouter = require('./src/routes/doctors');
const patientsRouter = require('./src/routes/patients');
const appointmentsRouter = require('./src/routes/appointments');
const authRouter = require('./src/routes/auth');
const { requireAuth } = require('./src/middleware/auth');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', authRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/patients', requireAuth, patientsRouter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'Healthy',
    service: 'hospital-queue-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/db-health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.status(200).json({
      status: 'Healthy',
      database: 'hospital_queue',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);

    res.status(500).json({
      status: 'Unhealthy',
      database: 'hospital_queue',
      message: 'Connection failed'
    });
  }
});

app.use('/api/appointments', requireAuth, appointmentsRouter);
app.get('/debug-route', (req, res) => {
  res.send('Debug route is working');
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
