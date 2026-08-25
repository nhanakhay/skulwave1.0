const db = require('../db/database');

exports.list = async (_req, res) => {
  try {
    const [transactions, cashSales] = await Promise.all([db.getPreparedStatement('getRevenueTransactions').all(), db.allAsync(`SELECT s.id,s.sold_at AS created_at,s.student_price AS amount,s.reseller_commission,s.skulwave_amount,v.hotspot_username,p.name AS package_name,r.name AS reseller_name FROM reseller_sales s JOIN vouchers v ON v.id=s.voucher_id JOIN packages p ON p.id=s.package_id JOIN resellers r ON r.id=s.reseller_id ORDER BY s.sold_at DESC`)]);
    const summary = await db.getAsync(`SELECT
      (SELECT COALESCE(SUM(student_price),0) FROM reseller_sales) AS cash_revenue,
      (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='success') AS payment_revenue`) || {};
    res.json({
      provider: 'Cash sales + Paystack',
      status: 'Paystack pending',
      total: Number(summary.cash_revenue || 0) + Number(summary.payment_revenue || 0),
      cashTotal: Number(summary.cash_revenue || 0),
      transactions,
      cashSales,
    });
  } catch (err) {
    console.error('[admin/revenue]', err);
    res.status(500).json({ error: 'Unable to load revenue data' });
  }
};
