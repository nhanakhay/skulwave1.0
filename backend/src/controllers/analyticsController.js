const db = require('../db/database');

exports.overview = async (_req, res) => {
  try {
    const [summary, packages, recentVouchers] = await Promise.all([
      db.getAsync(`SELECT
        (SELECT COUNT(*) FROM vouchers) AS total_vouchers,
        (SELECT COUNT(*) FROM vouchers WHERE status IN ('active','redeemed')) AS active_vouchers,
        (SELECT COUNT(*) FROM voucher_sessions WHERE status='active') AS active_sessions,
        (SELECT COUNT(*) FROM vouchers WHERE status IN ('unused','generated')) AS unused_vouchers,
        (SELECT COALESCE(SUM(student_price),0) FROM reseller_sales) AS cash_revenue,
        (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='success') AS payment_revenue`),
      db.getPreparedStatement('getPackageAnalytics').all(),
      db.getPreparedStatement('getRecentVouchers').all(6),
    ]);
    const safeSummary = summary || {};
    const totalRevenue = Number(safeSummary.cash_revenue || 0) + Number(safeSummary.payment_revenue || 0);
    res.json({ summary: { ...safeSummary, total_revenue: totalRevenue }, packages, recentVouchers });
  } catch (err) {
    console.error('[admin/analytics]', err);
    res.status(500).json({ error: 'Unable to load analytics' });
  }
};
