async function handleManagerLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const response = await fetch('/api/admin/manager-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return alert(data.error || 'Unable to log in.');
  // The manager portal uses the same protected API, but only receives a manager token.
  localStorage.setItem('adminApiKey', data.apiKey);
  localStorage.setItem('adminUsername', form.get('username'));
  localStorage.setItem('adminRole', 'SCHOOL_MANAGER');
  location.href = '/admin/resellers.html';
  return false;
}
