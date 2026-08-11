(function () {
  const key = localStorage.getItem('adminApiKey');
  const inAdmin = location.pathname.includes('/admin/');
  if (inAdmin && !key && !location.pathname.endsWith('/adminlogin.html')) location.replace('adminlogin.html');

  async function request(path, options = {}) {
    const response = await fetch(`/api/admin${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': localStorage.getItem('adminApiKey') || '', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { localStorage.removeItem('adminApiKey'); location.replace('adminlogin.html'); }
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }
  window.adminApi = { get: (path) => request(path), request };
})();
