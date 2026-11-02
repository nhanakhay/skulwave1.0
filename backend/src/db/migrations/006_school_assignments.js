async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '006_school_assignments',
  description: 'Create schools and assign School Managers and resellers without altering existing records',
  up: async (db) => {
    await db.exec('CREATE TABLE IF NOT EXISTS schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    await addColumnIfMissing(db, 'admin_accounts', 'school_id', 'school_id INTEGER');
    await addColumnIfMissing(db, 'resellers', 'school_id', 'school_id INTEGER');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_admin_accounts_school_id ON admin_accounts(school_id); CREATE INDEX IF NOT EXISTS idx_resellers_school_id ON resellers(school_id);');
  },
};
