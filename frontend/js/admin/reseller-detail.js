const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ngn = (v) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(v || 0);
const fmtDate = (value) => value ? new Date(value).toLocaleString() : '';

function sum(values, selector) {
  return values.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

async function loadResellerDetail() {
  const content = document.getElementById('adminContent');
  const url = new URL(window.location.href);
  const resellerId = url.searchParams.get('id');
  if (!resellerId) {
    content.innerHTML = '<div class="notice">Reseller ID is required.</div>';
    return;
  }

  content.innerHTML = '<div class="panel"><div class="empty">Loading reseller details...</div></div>';

  try {
    const data = await adminApi.get(`/resellers/${encodeURIComponent(resellerId)}`);
    const { reseller, vouchers, sales, settlements } = data;
    const totalSales = sum(sales, (item) => item.skulwave_amount);
    const totalCommission = sum(sales, (item) => item.reseller_commission);
    const totalOutstanding = totalSales - sum(settlements, (item) => item.amount);

    content.innerHTML = `
      <div class="panel-actions" style="margin-bottom:20px">
        <button class="primary-button" id="backButton">Back to resellers</button>
        <button class="primary-button" id="editResellerButton" type="button">Edit reseller</button>
      </div>
      <div class="panel form-card" id="editResellerPanel" style="margin-bottom:20px;display:none">
        <h3>Edit reseller</h3>
        <form id="editResellerForm" class="form-grid">
          <label>Name<input name="name" value="${esc(reseller.name)}" required></label>
          <label>Username<input name="username" value="${esc(reseller.username)}" required></label>
          <label>Phone<input name="phone" value="${esc(reseller.phone || '')}"></label>
          <label>New password <small>(leave empty to keep)</small><input name="password" type="password" minlength="6"></label>
          <label>Confirm new password<input name="confirm_password" type="password" minlength="6"></label>
          <button class="primary-button">Save changes</button>
        </form>
      </div>
      <div class="panel form-card">
        <h2>${esc(reseller.name)} (${esc(reseller.username)})</h2>
        <p class="lede">Status: <strong>${esc(reseller.status)}</strong></p>
        <div class="two-col">
          <div class="panel"><h3>Summary</h3>
            <div class="stat-card"><div class="stat-label">Total sold</div><div class="stat-value">${ngn(totalSales)}</div></div>
            <div class="stat-card"><div class="stat-label">Commission earned</div><div class="stat-value">${ngn(totalCommission)}</div></div>
            <div class="stat-card"><div class="stat-label">Outstanding</div><div class="stat-value">${ngn(totalOutstanding)}</div></div>
          </div>
          <div class="panel"><h3>Account</h3>
            <p><strong>Phone:</strong> ${esc(reseller.phone || '')}</p>
            <p><strong>Created:</strong> ${fmtDate(reseller.created_at)}</p>
            <p><strong>Last login:</strong> ${fmtDate(reseller.last_login_at)}</p>
          </div>
        </div>
      </div>

      <div class="panel table-wrap" style="margin-top:20px">
        <div class="panel-header"><h3>Vouchers</h3></div>
        <table>
          <thead><tr><th>PIN</th><th>Buyer</th><th>Package</th><th>Price</th><th>Status</th><th>Sold</th></tr></thead>
          <tbody>${vouchers.map((voucher) => `
              <tr>
                <td><strong>${esc(voucher.hotspot_username)}</strong></td>
                <td>${esc(voucher.buyer_full_name || '')}</td>
                <td>${esc(voucher.package_name)}</td>
                <td>${ngn(voucher.price)}</td>
                <td><span class="badge ${esc(voucher.status)}">${esc(voucher.status)}</span></td>
                <td>${esc(voucher.sold_at || '')}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">No vouchers yet.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="panel table-wrap" style="margin-top:20px">
        <div class="panel-header"><h3>Sales</h3></div>
        <table>
          <thead><tr><th>Voucher</th><th>Package</th><th>Student price</th><th>Commission</th><th>SkulWave</th><th>Sold</th></tr></thead>
          <tbody>${sales.map((sale) => `
              <tr>
                <td>${esc(sale.hotspot_username)}</td>
                <td>${esc(sale.package_name)}</td>
                <td>${ngn(sale.student_price)}</td>
                <td>${ngn(sale.reseller_commission)}</td>
                <td>${ngn(sale.skulwave_amount)}</td>
                <td>${esc(sale.sold_at)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">No sales yet.</td></tr>'}</tbody>
        </table>
      </div>

      <div class="panel form-card" style="margin-top:20px">
        <h3>Set selling credit</h3>
        <form id="creditForm" class="form-grid">
          <label>Available credit (GHS)<input name="credit_balance" type="number" min="0" step="0.01" value="${Number(reseller.credit_balance || 0)}" required></label>
          <button class="primary-button">Save credit</button>
        </form>
      </div>

      <div class="panel form-card" style="margin-top:20px">
        <h3>Record settlement</h3>
        <form id="settlementForm" class="form-grid">
          <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required></label>
          <label>Payment method<select name="payment_method" required><option value="CASH">Cash</option><option value="MOMO">MoMo</option><option value="OTHER">Other</option></select></label>
          <label>Reference<input name="reference"></label>
          <label>Notes<input name="notes"></label>
          <button class="primary-button">Record payment</button>
        </form>
      </div>

      <div class="panel table-wrap" style="margin-top:20px">
        <div class="panel-header"><h3>Settlements</h3></div>
        <table>
          <thead><tr><th>Amount</th><th>Method</th><th>Reference</th><th>Notes</th><th>Date</th></tr></thead>
          <tbody>${settlements.map((item) => `
              <tr>
                <td>${ngn(item.amount)}</td>
                <td>${esc(item.payment_method)}</td>
                <td>${esc(item.reference || '')}</td>
                <td>${esc(item.notes || '')}</td>
                <td>${esc(new Date(item.created_at).toLocaleString())}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="empty">No settlements yet.</td></tr>'}</tbody>
        </table>
      </div>
    `;

    document.getElementById('backButton').onclick = () => {
      location.href = 'resellers.html';
    };
    document.getElementById('editResellerButton').onclick = () => {
      const panel = document.getElementById('editResellerPanel');
      const visible = panel.style.display !== 'none';
      panel.style.display = visible ? 'none' : 'block';
      document.getElementById('editResellerButton').textContent = visible ? 'Edit reseller' : 'Close edit';
    };
    const editPanel = document.getElementById('editResellerPanel');
    const creditPanel = document.getElementById('creditForm').closest('.panel');
    const settlementPanel = document.getElementById('settlementForm').closest('.panel');
    editPanel.parentNode.insertBefore(creditPanel, editPanel.nextSibling);
    editPanel.parentNode.insertBefore(settlementPanel, creditPanel.nextSibling);

    document.getElementById('editResellerForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await adminApi.request(`/resellers/${encodeURIComponent(resellerId)}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        await loadResellerDetail();
      } catch (err) { alert(err.message); }
    };

    document.getElementById('creditForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await adminApi.request(`/resellers/${encodeURIComponent(resellerId)}`, {
          method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))),
        });
        await loadResellerDetail();
      } catch (err) { alert(err.message); }
    };

    document.getElementById('settlementForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await adminApi.request(`/resellers/${encodeURIComponent(resellerId)}/settlements`, {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(new FormData(event.target))),
        });
        await loadResellerDetail();
      } catch (err) {
        alert(err.message);
      }
    };
  } catch (error) {
    content.innerHTML = `<div class="notice">${esc(error.message)}</div>`;
  }
}

if (document.body.dataset.page === 'reseller-detail') loadResellerDetail();
