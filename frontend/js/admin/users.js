const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtDate = (value) => value ? new Date(value).toLocaleString() : '—';
function rows(items, columns) { return items.length ? items.map(columns).join('') : `<tr><td colspan="6" class="empty">No records yet.</td></tr>`; }
async function loadUsers() {
  const content = document.getElementById('adminContent');
  content.innerHTML = '<h2>Users</h2><p class="lede">Voucher holders issued through SkulWave.</p><div class="panel"><div class="empty">Loading users…</div></div>';
  try { const { users } = await adminApi.get('/users'); content.innerHTML = `<h2>Users</h2><p class="lede">Voucher holders issued through SkulWave.</p><div class="panel table-wrap"><table><thead><tr><th>Username</th><th>Buyer</th><th>Package</th><th>Status</th><th>Issued</th><th>Redeemed</th><th>Valid until</th></tr></thead><tbody>${rows(users, (u) => `<tr><td><strong>${esc(u.username)}</strong></td><td>${esc(u.buyer_full_name || '')}</td><td>${esc(u.package_name)}</td><td><span class="badge ${esc(u.status)}">${esc(u.status)}</span></td><td>${fmtDate(u.created_at)}</td><td>${fmtDate(u.redeemed_at)}</td><td>${fmtDate(u.valid_until)}</td></tr>`)}</tbody></table></div>`; } catch (e) { content.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
}
if (document.body.dataset.page === 'users') loadUsers();
