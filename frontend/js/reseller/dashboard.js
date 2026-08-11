const token = localStorage.getItem('resellerToken');
if (!token) location.replace('login.html');

const api = async (path, opts = {}) => {
  const response = await fetch('/api/resellers' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const fmt = (value) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(value || 0);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function render() {
  const [dashboard, packages, vouchers, sales, settlements] = await Promise.all([
    api('/dashboard'),
    api('/packages'),
    api('/vouchers'),
    api('/sales'),
    api('/settlements'),
  ]);

  const summary = dashboard.summary;
  const hasSettlements = settlements.settlements.length > 0;

  document.getElementById('resellerContent').innerHTML = `
    <div class="topbar" style="margin:-30px -34px 30px">
      <h1 class="page-title">SkulWave reseller</h1>
      <button id="logout">Log out</button>
    </div>
    <h2>Hello, ${esc(localStorage.getItem('resellerName'))}</h2>
    <p class="lede">Generate, sell, and track your vouchers.</p>

    <div class="stats">
      <div class="stat-card"><div class="stat-label">Today's sales</div><div class="stat-value">${fmt(summary.today_sales)}</div></div>
      <div class="stat-card"><div class="stat-label">Today's commission</div><div class="stat-value">${fmt(summary.today_commission)}</div></div>
      <div class="stat-card"><div class="stat-label">Amount owed</div><div class="stat-value">${fmt(summary.outstanding)}</div></div>
      <div class="stat-card"><div class="stat-label">Selling credit</div><div class="stat-value">${fmt(summary.credit_balance)}</div><div class="stat-note">Deducted when a voucher is marked sold</div></div>
      <div class="stat-card"><div class="stat-label">Vouchers sold</div><div class="stat-value">${summary.vouchers_sold}</div></div>
    </div>

    <div class="panel form-card">
      <h3>Generate voucher</h3>
      <form id="generate">
        <div class="form-grid">
          <label>Package<select name="package_id">${packages.packages.map((pkg) => `<option value="${pkg.id}">${esc(pkg.name)} â€” ${fmt(pkg.price)}</option>`).join('')}</select></label>
          <button class="primary-button">Generate</button>
        </div>
      </form>
      <div id="pin" class="generated-output" style="display:none;margin-top:16px"></div>
    </div>

    <div class="panel table-wrap" style="margin-top:20px">
      <div class="panel-header"><h3>Recent vouchers</h3></div>
      <table>
        <thead><tr><th>PIN</th><th>Package</th><th>Price</th><th>Status</th><th>Sold</th></tr></thead>
        <tbody>${vouchers.vouchers.map((voucher) => `
            <tr>
              <td><strong>${esc(voucher.hotspot_username)}</strong></td>
              <td>${esc(voucher.package_name)}</td>
              <td>${fmt(voucher.price)}</td>
              <td><span class="badge ${esc(voucher.status)}">${esc(voucher.status)}</span></td>
              <td>${voucher.status === 'generated' ? `<button class="primary-button sell" data-id="${voucher.id}">Mark sold</button>` : esc(voucher.sold_at || 'â€”')}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="empty">No vouchers yet.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="panel table-wrap" style="margin-top:20px">
      <div class="panel-header"><h3>Settlements</h3></div>
      <table>
        <thead><tr><th>Amount</th><th>Method</th><th>Reference</th><th>Notes</th><th>Date</th></tr></thead>
        <tbody>${hasSettlements ? settlements.settlements.map((item) => `
            <tr>
              <td>${fmt(item.amount)}</td>
              <td>${esc(item.payment_method)}</td>
              <td>${esc(item.reference || 'â€”')}</td>
              <td>${esc(item.notes || 'â€”')}</td>
              <td>${esc(new Date(item.created_at).toLocaleString())}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="empty">No settlements recorded yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  document.getElementById('logout').onclick = () => {
    localStorage.removeItem('resellerToken');
    localStorage.removeItem('resellerName');
    location.href = 'login.html';
  };

  document.getElementById('generate').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await api('/vouchers', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(event.target))),
      });
      const pin = document.getElementById('pin');
      pin.style.display = 'block';
      pin.textContent = `PIN: ${response.voucher.hotspot_username}
Package: ${response.voucher.package_name}
Price: ${fmt(response.voucher.price)}
Status: GENERATED

Copy this PIN, then mark it SOLD after payment.`;
      render();
    } catch (error) {
      alert(error.message);
    }
  };

  document.querySelectorAll('.sell').forEach((button) => {
    button.onclick = async () => {
      try {
        await api(`/vouchers/${button.dataset.id}/sell`, { method: 'POST' });
        render();
      } catch (error) {
        alert(error.message);
      }
    };
  });
}

render().catch((error) => {
  document.getElementById('resellerContent').innerHTML = `<div class="notice">${esc(error.message)}</div>`;
});
