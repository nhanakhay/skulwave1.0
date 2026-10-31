// Escape server-provided text before adding it to the page HTML.
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

async function loadSchoolManagers() {
  const content = document.getElementById('adminContent');

  // Re-render after each create or status change, just like the Resellers page.
  const render = async () => {
    const { schoolManagers } = await adminApi.get('/school-managers');
    content.innerHTML = `
      <h2>School Managers</h2>
      <p class="lede">Create School Manager accounts and manage their access.</p>
      <div class="panel form-card">
        <h3>Create School Manager</h3>
        <form id="schoolManagerForm" class="form-grid">
          <label>Name<input name="name" required></label>
          <label>Username<input name="username" required></label>
          <label>Password<input name="password" type="password" minlength="6" required></label>
          <label>Confirm password<input name="confirm_password" type="password" minlength="6" required></label>
          <button class="primary-button">Create School Manager</button>
        </form>
      </div>
      <div class="panel table-wrap" style="margin-top:20px">
        <table>
          <thead><tr><th>School Manager</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
          <tbody>${schoolManagers.length ? schoolManagers.map((manager) => `
            <tr>
              <td><strong>${esc(manager.name)}</strong><br><small>${esc(manager.username)}</small></td>
              <td><span class="badge ${manager.status === 'ACTIVE' ? 'active' : 'expired'}">${esc(manager.status)}</span></td>
              <td>${manager.created_at ? new Date(manager.created_at).toLocaleString() : '—'}</td>
              <td><button class="primary-button view-activity" data-id="${manager.id}">View</button> <button class="primary-button toggle-manager" data-id="${manager.id}" data-status="${manager.status}">${manager.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button></td>
            </tr>`).join('') : '<tr><td colspan="4" class="empty">No School Managers yet.</td></tr>'}</tbody>
        </table>
      </div>`;

    document.getElementById('schoolManagerForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await adminApi.request('/school-managers', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        event.target.reset();
        await render();
      } catch (error) { alert(error.message); }
    };

    content.querySelectorAll('.toggle-manager').forEach((button) => {
      button.onclick = async () => {
        try {
          await adminApi.request(`/school-managers/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) });
          await render();
        } catch (error) { alert(error.message); }
      };
    });
    content.querySelectorAll('.view-activity').forEach((button) => {
      button.onclick = () => { location.href = `schoolManagerActivity.html?id=${encodeURIComponent(button.dataset.id)}`; };
    });
  };

  try { await render(); }
  catch (error) { content.innerHTML = `<div class="notice">${esc(error.message)}</div>`; }
}

if (document.body.dataset.page === 'schoolManagers') loadSchoolManagers();
