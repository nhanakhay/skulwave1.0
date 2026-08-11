const db = require('../db/database');

exports.list = async (_req, res) => {
  try {
    const sessions = await db.getPreparedStatement('getAdminSessions').all();
    res.json({ sessions });
  } catch (err) {
    console.error('[admin/sessions]', err);
    res.status(500).json({ error: 'Unable to load sessions' });
  }
};
