const express = require('express');
const router = express.Router();

// Payment routes are temporarily disabled while voucher support is built.
router.get('/', (req, res) => {
  res.status(503).json({
    error: 'Payment routes are disabled until voucher support is implemented.'
  });
});

module.exports = router;
