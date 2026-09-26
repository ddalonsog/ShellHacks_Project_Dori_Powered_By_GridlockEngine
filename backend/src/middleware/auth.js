const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(
      header.substring(7),
      process.env.JWT_SECRET
    );

    next();
  } catch {
    res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
};