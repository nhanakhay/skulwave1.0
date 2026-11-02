const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const ghs = (v) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(v || 0));
async function loadSchoolManagerActivity() {
  const content = document.getElementById('adminContent');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return content.innerHTML = '<div class="notice">School Manager ID is required.</div>';
  const render = async () => {
    const date = new URLSearchParams(location.search).get('date') || new Date().toISOString().slice(0, 10);
    const data = await adminApi.get(`/school-managers/${encodeURIComponent(id)}/settlement-activity?date=${encodeURIComponent(date)}`);
    content.innerHTML = `<div class="page-actions"><button class="primary-button" id="back">Back to School Managers</button><label>Settlement date <input id="date" type="date" value="${date}"></label></div><h2>${esc(data.manager.name)} — settlement activity</h2><div class="stats"><div class="stat-card"><div class="stat-label">Received on selected date</div><div class="stat-value">${ghs(data.selectedDay.total)}</div><div class="stat-note">${data.selectedDay.count} settlement(s)</div></div></div><div class="panel table-wrap"><h3>All settlements received</h3><table><thead><tr><th>Date</th><th>Reseller</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>${data.settlements.length ? data.settlements.map(s=>`<tr><td>${new Date(s.created_at).toLocaleString()}</td><td>${esc(s.reseller_name)}</td><td>${ghs(s.amount)}</td><td>${esc(s.payment_method)}</td><td>${esc(s.reference || '')}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No settlements recorded by this manager.</td></tr>'}</tbody></table></div>`;
    document.getElementById('back').onclick = () => { location.href = 'schoolManagers.html'; };
    document.getElementById('date').onchange = (event) => { location.search = `?id=${encodeURIComponent(id)}&date=${encodeURIComponent(event.target.value)}`; };
  };
  try { await render(); } catch (error) { content.innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
if (document.body.dataset.page === 'schoolManagerActivity') loadSchoolManagerActivity();
