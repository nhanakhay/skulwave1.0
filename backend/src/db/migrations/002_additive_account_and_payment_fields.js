async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '002_additive_account_and_payment_fields',
  description: 'Add account, payment, voucher, and session fields without changing existing values',
  up: async (db) => {
    await addColumnIfMissing(db, 'packages', 'reseller_enabled', 'reseller_enabled INTEGER NOT NULL DEFAULT 1');
    await addColumnIfMissing(db, 'packages', 'reseller_commission_percent', 'reseller_commission_percent REAL NOT NULL DEFAULT 1');
    await addColumnIfMissing(db, 'vouchers', 'reseller_id', 'reseller_id INTEGER');
    await addColumnIfMissing(db, 'vouchers', 'sold_at', 'sold_at DATETIME');
    await addColumnIfMissing(db, 'vouchers', 'buyer_full_name', 'buyer_full_name TEXT');
    await addColumnIfMissing(db, 'users', 'email', 'email TEXT');
    await addColumnIfMissing(db, 'users', 'hotspot_username', 'hotspot_username TEXT');
    await addColumnIfMissing(db, 'users', 'hotspot_password_hash', 'hotspot_password_hash TEXT');
    await addColumnIfMissing(db, 'users', 'active_package_id', 'active_package_id INTEGER');
    await addColumnIfMissing(db, 'users', 'package_expires_at', 'package_expires_at DATETIME');
    await addColumnIfMissing(db, 'users', 'status', "status TEXT NOT NULL DEFAULT 'INACTIVE'");
    await addColumnIfMissing(db, 'transactions', 'paid_at', 'paid_at DATETIME');
    await addColumnIfMissing(db, 'transactions', 'payment_channel', 'payment_channel TEXT');
    await addColumnIfMissing(db, 'transactions', 'access_granted_at', 'access_granted_at DATETIME');
    await addColumnIfMissing(db, 'sessions', 'hotspot_username', 'hotspot_username TEXT');
    await addColumnIfMissing(db, 'sessions', 'expires_at', 'expires_at DATETIME');
  },
};
