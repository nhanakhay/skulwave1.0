const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ngn = (v) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(v || 0);

async function loadResellers() {
  const c = document.getElementById('adminContent');

  const render = async () => {
    const d = await adminApi.get('/resellers');
    c.innerHTML = `
      <h2>Resellers</h2>
      <p class="lede">Create accounts and manage sales balances.</p>
      <div class="panel form-card">
        <h3>Create reseller</h3>
        <form id="resellerForm" class="form-grid">
          <label>Name<input name="name" required></label>
          <label>Phone<input name="phone"></label>
          <label>Username<input name="username" required></label>
          <label>Password<input name="password" type="password" minlength="6" required></label>
          <label>Starting credit (GHS)<input name="credit_balance" type="number" min="0" step="0.01" value="0" required></label>
          <button class="primary-button">Create reseller</button>
        </form>
      </div>
      <div class="panel table-wrap" style="margin-top:20px">
        <table>
          <thead>
            <tr>
              <th>Reseller</th>
              <th>Sales</th>
              <th>Commission</th>
              <th>Credit</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th>Details</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${d.resellers.length ? d.resellers.map((r) => `
              <tr>
                <td><strong>${esc(r.name)}</strong><br><small>${esc(r.username)}</small></td>
                <td>${ngn(r.total_sales)}</td>
                <td>${ngn(r.commission)}</td>
                <td>${ngn(r.credit_balance)}</td>
                <td>${ngn(r.outstanding)}</td>
                <td><span class="badge ${r.status === 'ACTIVE' ? 'active' : 'expired'}">${esc(r.status)}</span></td>
                <td><button class="primary-button view-detail" data-id="${r.id}">View</button></td>
                <td><button class="primary-button toggle" data-id="${r.id}" data-status="${r.status}">${r.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button></td>
              </tr>
            `).join('') : '<tr><td colspan="8" class="empty">No resellers yet.</td></tr>'}</tbody>
        </table>
      </div>
    `;

    document.getElementById('resellerForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await adminApi.request('/resellers', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
        });
        await render();
      } catch (error) {
        alert(error.message);
      }
    };

    c.querySelectorAll('.toggle').forEach((button) => {
      button.onclick = async () => {
        try {
          await adminApi.request(`/resellers/${button.dataset.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: button.dataset.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
          });
          await render();
        } catch (error) {
          alert(error.message);
        }
      };
    });

    c.querySelectorAll('.view-detail').forEach((button) => {
      button.onclick = () => {
        location.href = `reseller-detail.html?id=${encodeURIComponent(button.dataset.id)}`;
      };
    });
  };

  try {
    await render();
  } catch (error) {
    c.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
  }
}

if (document.body.dataset.page === 'resellers') loadResellers();
