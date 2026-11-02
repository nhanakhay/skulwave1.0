const form = document.getElementById('passwordChangeForm');
const message = document.getElementById('passwordMessage');
form.onsubmit = async (event) => {
  event.preventDefault();
  const token = sessionStorage.getItem('skulwaveAccountToken');
  if (!token) return (location.href = 'login.html');
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const response = await fetch('/api/payment/password-change', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-account-token': token }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to change password.');
    location.href = 'packages.html';
  } catch (error) { message.textContent = error.message; button.disabled = false; }
};
