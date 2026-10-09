const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'Healthy',
    service: "hospital-queue-api",
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});