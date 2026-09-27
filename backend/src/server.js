const express = require('express');
const cors = require('cors');
require('dotenv').config();

const projectsRouter = require('./routes/projects');
const conflictsRouter = require('./routes/conflicts');
const authRouter = require('./routes/auth');
const notificationsRouter = require('./routes/notifications');
const collaborationsRouter = require('./routes/collaborations');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'GridLock backend is running',
  });
});

app.use('/api/projects', projectsRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/collaborations', collaborationsRouter);
app.listen(PORT, () => {
  console.log(`GridLock backend running on http://localhost:${PORT}`);
});
