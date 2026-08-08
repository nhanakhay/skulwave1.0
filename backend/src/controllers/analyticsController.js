const db = require('../db/database');

exports.overview = async (_req, res) => {
  try {
    const [summary, packages, recentVouchers] = await Promise.all([
      db.getPreparedStatement('getDashboardSummary').get(),
      db.getPreparedStatement('getPackageAnalytics').all(),
      db.getPreparedStatement('getRecentVouchers').all(6),
    ]);
    const totalRevenue = Number(summary.voucher_revenue || 0) + Number(summary.payment_revenue || 0);
    res.json({ summary: { ...summary, total_revenue: totalRevenue }, packages, recentVouchers });
  } catch (err) {
    console.error('[admin/analytics]', err);
    res.status(500).json({ error: 'Unable to load analytics' });
  }
};
