async function addColumnIfMissing({ all, run }, table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

module.exports = {
  id: '010_track_payment_access_path',
  description: 'Store the hotspot login path used for paid access',
  up: async (db) => addColumnIfMissing(db, 'transactions', 'router_login', 'router_login TEXT'),
};
