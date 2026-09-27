const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get collaboration requests involving the logged-in user's utility
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        cr.id,
        cr.project_id,
        p.title AS project_title,
        cr.sender_utility_id,
        cr.recipient_utility_id,
        cr.message,
        cr.status,
        cr.created_at
      FROM collaboration_requests cr
      JOIN projects p ON p.id = cr.project_id
      WHERE
        cr.sender_utility_id = $1
        OR cr.recipient_utility_id = $1
      ORDER BY cr.created_at DESC;
      `,
      [req.user.utility_id]
    );

    res.json({
      requests: result.rows,
    });
  } catch (error) {
    console.error('Error loading collaboration requests:', error);

    res.status(500).json({
      error: 'Unable to load collaboration requests',
    });
  }
});

// Create a collaboration request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      project_id,
      recipient_utility_id,
      message,
    } = req.body;

    if (!project_id || !recipient_utility_id) {
      return res.status(400).json({
        error: 'Project and recipient utility are required',
      });
    }

    if (Number(recipient_utility_id) === Number(req.user.utility_id)) {
      return res.status(400).json({
        error: 'Cannot send a collaboration request to your own utility',
      });
    }

    const projectResult = await pool.query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
        AND utility_id = $2;
      `,
      [project_id, req.user.utility_id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(403).json({
        error: 'You can only send requests for your own projects',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO collaboration_requests (
        project_id,
        sender_utility_id,
        recipient_utility_id,
        message
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        project_id,
        sender_utility_id,
        recipient_utility_id,
        message,
        status,
        created_at;
      `,
      [
        project_id,
        req.user.utility_id,
        recipient_utility_id,
        message || null,
      ]
    );

    res.status(201).json({
      message: 'Collaboration request created successfully',
      request: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating collaboration request:', error);

    res.status(500).json({
      error: 'Unable to create collaboration request',
    });
  }
});

// Accept or decline a collaboration request
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be accepted or declined',
      });
    }

    const result = await pool.query(
      `
      UPDATE collaboration_requests
      SET status = $1
      WHERE id = $2
        AND recipient_utility_id = $3
        AND status = 'pending'
      RETURNING
        id,
        project_id,
        sender_utility_id,
        recipient_utility_id,
        message,
        status,
        created_at;
      `,
      [status, req.params.id, req.user.utility_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Collaboration request not found or already processed',
      });
    }

    res.json({
      message: `Collaboration request ${status}`,
      request: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating collaboration request:', error);

    res.status(500).json({
      error: 'Unable to update collaboration request',
    });
  }
});

module.exports = router;