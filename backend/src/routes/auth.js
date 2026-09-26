const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      utility_id: user.utility_id,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
}

// Register
router.post('/register', async (req, res) => {
  try {
    const {
      utility_id,
      name,
      email,
      password,
      contact_visibility,
    } = req.body;

    if (!utility_id || !name || !email || !password) {
      return res.status(400).json({
        error: 'Missing required registration fields',
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (
        utility_id,
        name,
        email,
        password_hash,
        contact_visibility
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        utility_id,
        name,
        email,
        contact_visibility,
        created_at;
      `,
      [
        utility_id,
        name,
        email,
        passwordHash,
        contact_visibility || 'authenticated',
      ]
    );

    const user = result.rows[0];
    const token = createToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user,
    });
  } catch (error) {
    console.error('Error registering user:', error);

    res.status(500).json({
      error: 'Unable to register user',
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        utility_id,
        name,
        email,
        password_hash,
        contact_visibility
      FROM users
      WHERE email = $1;
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const token = createToken(user);

    delete user.password_hash;

    res.json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    console.error('Error logging in:', error);

    res.status(500).json({
      error: 'Unable to log in',
    });
  }
});

// Current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        utility_id,
        name,
        email,
        contact_visibility,
        created_at
      FROM users
      WHERE id = $1;
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error loading current user:', error);

    res.status(500).json({
      error: 'Unable to load current user',
    });
  }
});

module.exports = router;
