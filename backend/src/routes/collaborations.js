const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();


// ==========================================
// GET COLLABORATION REQUESTS
// ==========================================

// Get collaboration requests involving
// the logged-in user's utility.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        cr.id,

        cr.project1_id,
        p1.title AS project1_title,

        cr.project2_id,
        p2.title AS project2_title,

        cr.sender_utility_id,
        cr.receiver_utility_id,

        cr.message,
        cr.status,
        cr.created_at

      FROM collaboration_requests cr

      LEFT JOIN projects p1
        ON p1.id = cr.project1_id

      LEFT JOIN projects p2
        ON p2.id = cr.project2_id

      WHERE
        cr.sender_utility_id = $1
        OR cr.receiver_utility_id = $1

      ORDER BY cr.created_at DESC;
      `,
      [req.user.utility_id]
    );

    res.json({
      requests: result.rows,
    });

  } catch (error) {
    console.error(
      'Error loading collaboration requests:',
      error
    );

    res.status(500).json({
      error: 'Unable to load collaboration requests',
    });
  }
});


// ==========================================
// CREATE COLLABORATION REQUEST
// ==========================================

router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      project_id,
      project2_id,
      recipient_utility_id,
      message,
    } = req.body;


    // Keep the frontend API compatible with
    // the version built by the other branch.
    if (!project_id || !recipient_utility_id) {
      return res.status(400).json({
        error:
          'Project and recipient utility are required',
      });
    }


    if (
      Number(recipient_utility_id) ===
      Number(req.user.utility_id)
    ) {
      return res.status(400).json({
        error:
          'Cannot send a collaboration request to your own utility',
      });
    }


    // The sender must own project1.
    const projectResult = await pool.query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
        AND utility_id = $2;
      `,
      [
        project_id,
        req.user.utility_id,
      ]
    );


    if (projectResult.rows.length === 0) {
      return res.status(403).json({
        error:
          'You can only send requests for your own projects',
      });
    }


    // If project2 is supplied, verify that it belongs
    // to the receiving utility.
    if (project2_id) {
      const project2Result = await pool.query(
        `
        SELECT id
        FROM projects
        WHERE id = $1
          AND utility_id = $2;
        `,
        [
          project2_id,
          recipient_utility_id,
        ]
      );


      if (project2Result.rows.length === 0) {
        return res.status(400).json({
          error:
            'The target project does not belong to the recipient utility',
        });
      }
    }


    const result = await pool.query(
      `
      INSERT INTO collaboration_requests (
        sender_utility_id,
        receiver_utility_id,
        project1_id,
        project2_id,
        message
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )

      RETURNING
        id,
        sender_utility_id,
        receiver_utility_id,
        project1_id,
        project2_id,
        message,
        status,
        created_at;
      `,
      [
        req.user.utility_id,
        recipient_utility_id,
        project_id,
        project2_id || null,
        message || null,
      ]
    );


    res.status(201).json({
      message:
        'Collaboration request created successfully',

      request:
        result.rows[0],
    });

  } catch (error) {
    console.error(
      'Error creating collaboration request:',
      error
    );

    res.status(500).json({
      error:
        'Unable to create collaboration request',
    });
  }
});


// ==========================================
// ACCEPT / DECLINE REQUEST
// ==========================================

router.patch(
  '/:id/status',
  authMiddleware,
  async (req, res) => {
    try {
      const { status } = req.body;


      if (
        !['accepted', 'declined'].includes(status)
      ) {
        return res.status(400).json({
          error:
            'Status must be accepted or declined',
        });
      }


      const result = await pool.query(
        `
        UPDATE collaboration_requests

        SET status = $1

        WHERE id = $2
          AND receiver_utility_id = $3
          AND status = 'pending'

        RETURNING
          id,
          sender_utility_id,
          receiver_utility_id,
          project1_id,
          project2_id,
          message,
          status,
          created_at;
        `,
        [
          status,
          req.params.id,
          req.user.utility_id,
        ]
      );


      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            'Collaboration request not found or already processed',
        });
      }


      res.json({
        message:
          `Collaboration request ${status}`,

        request:
          result.rows[0],
      });

    } catch (error) {
      console.error(
        'Error updating collaboration request:',
        error
      );

      res.status(500).json({
        error:
          'Unable to update collaboration request',
      });
    }
  }
);


module.exports = router;