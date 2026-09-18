async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '003_reseller_tables',
  description: 'Create reseller records and their non-destructive supporting fields',
  up: async (db) => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS resellers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, phone TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE', credit_balance REAL NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login_at DATETIME);
      CREATE TABLE IF NOT EXISTS reseller_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_id INTEGER UNIQUE NOT NULL, reseller_id INTEGER NOT NULL, package_id INTEGER NOT NULL, student_price REAL NOT NULL, reseller_commission REAL NOT NULL, skulwave_amount REAL NOT NULL, sold_at DATETIME NOT NULL, redeemed_at DATETIME, settlement_status TEXT NOT NULL DEFAULT 'UNSETTLED', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS reseller_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, reseller_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL, reference TEXT, notes TEXT, recorded_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
    await addColumnIfMissing(db, 'resellers', 'credit_balance', 'credit_balance REAL NOT NULL DEFAULT 0');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_reseller_sales_sold_at ON reseller_sales(sold_at);');
  },
};
