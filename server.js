
require('dotenv').config();

const express = require('express');
const pool = require('./src/config/db');
const doctorsRouter = require('./src/routes/doctors');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use('/api/doctors', doctorsRouter);

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
