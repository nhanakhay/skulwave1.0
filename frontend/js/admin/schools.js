const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
async function loadSchools() {
  const content = document.getElementById('adminContent');
  const render = async () => {
    const data = await adminApi.get('/schools');
    const option = (item) => `<option value="${item.id}">${esc(item.name)} (${esc(item.username)})</option>`;
    content.innerHTML = `<h2>Schools</h2><p class="lede">Create a school, then assign its School Managers and resellers.</p><div class="panel form-card"><form id="schoolForm" class="form-grid"><label>School name<input name="name" required></label><label>School Managers<select name="manager_ids" multiple size="5">${data.managers.map(option).join('')}</select></label><label>Resellers<select name="reseller_ids" multiple size="5">${data.resellers.map(option).join('')}</select></label><button class="primary-button">Create school</button></form></div><div class="panel table-wrap" style="margin-top:20px"><table><thead><tr><th>School</th><th>Created</th></tr></thead><tbody>${data.schools.length ? data.schools.map(s=>`<tr><td>${esc(s.name)}</td><td>${new Date(s.created_at).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No schools yet.</td></tr>'}</tbody></table></div>`;
    document.getElementById('schoolForm').onsubmit = async (event) => { event.preventDefault(); const form = new FormData(event.target); const body = { name: form.get('name'), manager_ids: form.getAll('manager_ids'), reseller_ids: form.getAll('reseller_ids') }; try { await adminApi.request('/schools', { method: 'POST', body: JSON.stringify(body) }); await render(); } catch (error) { alert(error.message); } };
  };
  try { await render(); } catch (error) { content.innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}
if (document.body.dataset.page === 'schools') loadSchools();
