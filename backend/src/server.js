require('dotenv').config();

// Sets up the Express server and routes for the GridLock API.
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const conflictRoutes = require('./routes/conflicts');

// Future routes
// const collaborationRoutes = require('./routes/collaborations');
// const messageRoutes = require('./routes/messages');
// const notificationRoutes = require('./routes/notifications');
// const analyticsRoutes = require('./routes/analytics');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));


// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});


// ==========================================
// API ROUTES
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/conflicts', conflictRoutes);

// Future routes
// app.use('/api/collaborations', collaborationRoutes);
// app.use('/api/messages', messageRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/analytics', analyticsRoutes);


// ==========================================
// DATABASE CONNECTION TEST
// ==========================================

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      status: 'Database connected',
      time: result.rows[0].now
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: 'Database connection failed',
      error: error.message
    });
  }
});


// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`GridLock API running on http://localhost:${PORT}`);
});