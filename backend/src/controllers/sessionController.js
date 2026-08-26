const db = require('../db/database');

exports.list = async (req, res) => {
  try {
    const date=String(req.query.date||'');
    const sessions = await db.allAsync(`SELECT * FROM (SELECT vs.id,vs.hotspot_username,p.name AS package_name,vs.start_time,vs.expires_at,vs.end_time,vs.status,'voucher' source FROM voucher_sessions vs LEFT JOIN vouchers v ON v.id=vs.voucher_id LEFT JOIN packages p ON p.id=v.package_id UNION ALL SELECT s.id,s.hotspot_username,p.name,s.start_time,s.expires_at,s.end_time,s.status,'payment' source FROM sessions s LEFT JOIN packages p ON p.id=s.package_id) WHERE (?='' OR date(start_time)=date(?)) ORDER BY start_time DESC`,[date,date]);
    res.json({ sessions });
  } catch (err) {
    console.error('[admin/sessions]', err);
    res.status(500).json({ error: 'Unable to load sessions' });
  }
};
