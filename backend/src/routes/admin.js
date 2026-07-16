const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ apiKey: process.env.ADMIN_API_KEY });
  }

  return res.status(401).json({ error: 'Invalid admin credentials' });
});

router.get('/packages', async (req, res) => {
  try {
    const packages = await db.getPreparedStatement('getAllPackages').all();
    res.json({ packages });
  } catch (err) {
    console.error('[admin/packages]', err);
    res.status(500).json({ error: err.message || 'Unable to fetch packages' });
  }
});

module.exports = router;
