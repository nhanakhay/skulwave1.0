async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '007_track_manager_settlements',
  description: 'Record the School Manager who received a reseller settlement',
  up: async (db) => {
    await addColumnIfMissing(db, 'reseller_settlements', 'recorded_by_manager_id', 'recorded_by_manager_id INTEGER');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_reseller_settlements_manager_id ON reseller_settlements(recorded_by_manager_id)');
  },
};
