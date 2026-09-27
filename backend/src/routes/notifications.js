const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        project_id,
        type,
        message,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC;
      `,
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
    });
  } catch (error) {
    console.error('Error loading notifications:', error);

    res.status(500).json({
      error: 'Unable to load notifications',
    });
  }
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1
        AND user_id = $2
      RETURNING id, project_id, type, message, is_read, created_at;
      `,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Notification not found',
      });
    }

    res.json({
      notification: result.rows[0],
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);

    res.status(500).json({
      error: 'Unable to update notification',
    });
  }
});

module.exports = router;
