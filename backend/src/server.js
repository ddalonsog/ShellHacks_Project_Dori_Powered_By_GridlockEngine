require('dotenv').config();

// Sets up the Express server and routes for the GridLock API.
// Commented out routes are placeholders for future implementation of additional features.
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
//const projectRoutes = require('./routes/projects');
//const conflictRoutes = require('./routes/conflicts');
//const collaborationRoutes = require('./routes/collaborations');
//const messageRoutes = require('./routes/messages');
//const notificationRoutes = require('./routes/notifications');
//const analyticsRoutes = require('./routes/analytics');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
//app.use('/api/projects', projectRoutes);
//app.use('/api/conflicts', conflictRoutes);
//app.use('/api/collaborations', collaborationRoutes);
//app.use('/api/messages', messageRoutes);
//app.use('/api/notifications', notificationRoutes);
//app.use('/api/analytics', analyticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`GridLock API running on http://localhost:${PORT}`));
