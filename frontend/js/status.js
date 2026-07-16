const statusText = document.getElementById('statusText');
const detail = document.getElementById('detail');

async function checkConnection() {
  if (!navigator.onLine) {
    statusText.textContent = 'Offline';
    statusText.className = 'offline';
    detail.textContent = 'No network connection detected.';
    return;
  }

  try {
    const resp = await fetch(`/api/vouchers`, { method: 'GET', cache: 'no-store' });
    if (resp.ok) {
      statusText.textContent = 'Online';
      statusText.className = 'online';
      detail.textContent = 'You are connected to the Internet.';
    } else {
      statusText.textContent = 'Limited';
      statusText.className = 'offline';
      detail.textContent = `Server responded: ${resp.status}`;
    }
  } catch (err) {
    statusText.textContent = 'Offline';
    statusText.className = 'offline';
    detail.textContent = 'Unable to reach backend.';
  }
}

checkConnection();
setInterval(checkConnection, 5000);
