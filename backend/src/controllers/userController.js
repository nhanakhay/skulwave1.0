const db = require('../db/database');
exports.list = async (req,res) => { try {
  const users = req.admin.role === 'SCHOOL_MANAGER'
    ? await db.allAsync(`SELECT v.id,v.hotspot_username AS username,p.name AS package_name,v.buyer_full_name,v.status,
      v.created_at,v.redeemed_at,v.valid_until FROM vouchers v LEFT JOIN packages p ON p.id=v.package_id 
      JOIN resellers r ON r.id=v.reseller_id WHERE r.school_id=? ORDER BY v.created_at DESC`, [req.admin.school_id])
    : await db.getPreparedStatement('getAdminUsers').all();
  const accountUsers = await db.allAsync('SELECT id,username,email,status,must_change_password,created_at,password_reset_at FROM users ORDER BY created_at DESC');
  res.json({users, accountUsers});
} catch (_) { res.status(500).json({error:'Unable to load users'}); } };
