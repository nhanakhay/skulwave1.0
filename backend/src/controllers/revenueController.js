const db = require('../db/database');

exports.list = async (_req, res) => {
  try {
    const transactions = await db.getPreparedStatement('getRevenueTransactions').all();
    const summary = await db.getPreparedStatement('getDashboardSummary').get();
    res.json({
      provider: 'Paystack',
      status: 'stub',
      total: Number(summary.payment_revenue || 0),
      transactions,
    });
  } catch (err) {
    console.error('[admin/revenue]', err);
    res.status(500).json({ error: 'Unable to load revenue data' });
  }
};
