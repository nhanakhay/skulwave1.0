async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '004_school_manager_support',
  description: 'Add school manager ownership and remittance tracking',
  up: async (db) => {
    await addColumnIfMissing(db, 'admin_accounts', 'school_name', 'school_name TEXT');
    await addColumnIfMissing(db, 'resellers', 'school_manager_id', 'school_manager_id INTEGER');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS school_manager_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, school_manager_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL, reference TEXT, notes TEXT, recorded_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_manager_id) REFERENCES admin_accounts(id));
      CREATE INDEX IF NOT EXISTS idx_resellers_school_manager_id ON resellers(school_manager_id);
      CREATE INDEX IF NOT EXISTS idx_school_manager_settlements_manager_id ON school_manager_settlements(school_manager_id);
    `);
  },
};
