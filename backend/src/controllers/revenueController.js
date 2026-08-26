const db = require('../db/database');

exports.list = async (req, res) => {
  try {
    const date=String(req.query.date||''); const [transactions, cashSales] = await Promise.all([db.allAsync(`SELECT t.id,u.username,p.name AS package_name,t.amount,t.paystack_reference,t.status,t.created_at FROM transactions t LEFT JOIN users u ON u.id=t.user_id LEFT JOIN packages p ON p.id=t.package_id WHERE (?='' OR date(t.created_at)=date(?)) ORDER BY t.created_at DESC`,[date,date]), db.allAsync(`SELECT s.id,s.sold_at AS created_at,s.student_price AS amount,s.reseller_commission,s.skulwave_amount,v.hotspot_username,p.name AS package_name,r.name AS reseller_name FROM reseller_sales s JOIN vouchers v ON v.id=s.voucher_id JOIN packages p ON p.id=s.package_id JOIN resellers r ON r.id=s.reseller_id WHERE (?='' OR date(s.sold_at)=date(?)) ORDER BY s.sold_at DESC`,[date,date])]);
    const summary = await db.getAsync(`SELECT
      (SELECT COALESCE(SUM(student_price),0) FROM reseller_sales WHERE (?='' OR date(sold_at)=date(?))) AS cash_revenue,
      (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE status='success' AND (?='' OR date(created_at)=date(?))) AS payment_revenue`,[date,date,date,date]) || {};
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
