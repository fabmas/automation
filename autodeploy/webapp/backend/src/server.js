require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const deployRoutes = require('./routes/deploy');
const jobsRoutes = require('./routes/jobs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/deploy', deployRoutes);
app.use('/api/jobs', jobsRoutes);

// In production, serve the built frontend
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] listening on http://0.0.0.0:${PORT}`);
});
