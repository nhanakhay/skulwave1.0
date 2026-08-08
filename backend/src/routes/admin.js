const express = require('express');
const router = express.Router();
const db = require('../db/database');
const adminAuth = require('../middleware/adminAuth');
const userController = require('../controllers/userController');
const sessionController = require('../controllers/sessionController');
const revenueController = require('../controllers/revenueController');
const analyticsController = require('../controllers/analyticsController');

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

// Every dashboard endpoint below requires an authenticated admin API key.
router.use(adminAuth);

router.get('/packages', async (req, res) => {
  try {
    const packages = await db.getPreparedStatement('getAllPackages').all();
    res.json({ packages });
  } catch (err) {
    console.error('[admin/packages]', err);
    res.status(500).json({ error: err.message || 'Unable to fetch packages' });
  }
});

router.get('/users', userController.list);
router.get('/sessions', sessionController.list);
router.get('/revenue', revenueController.list);
router.get('/analytics', analyticsController.overview);
router.get('/dashboard', analyticsController.overview);

module.exports = router;
