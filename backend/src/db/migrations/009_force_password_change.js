async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '009_force_password_change',
  description: 'Track customer accounts that must change a temporary password',
  up: async (db) => {
    await addColumnIfMissing(db, 'users', 'must_change_password', 'must_change_password INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'users', 'password_reset_at', 'password_reset_at DATETIME');
  },
};
