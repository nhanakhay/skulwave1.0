// Use relative path so page works regardless of hostname/port
const apiBase = '/api/admin';

async function handleAdminLogin(event) {
    event.preventDefault();

    const username = document.adminLogin.username.value.trim();
    const password = document.adminLogin.password.value.trim();
    const loginBtn = document.getElementById('adminLoginBtn');
    const loginLoading = document.getElementById('adminLoginLoading');

    if (!username || !password) {
        alert('Please enter both admin username and password.');
        return false;
    }

    loginBtn.disabled = true;
    loginLoading.style.display = 'block';

    try {
        const url = `${apiBase}/login`;
        console.log('[adminlogin] POST', url, { username });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        let data = null;
        try { data = await response.json(); } catch (e) { data = null; }

        if (!response.ok) {
            const msg = (data && data.error) ? data.error : `Server responded ${response.status}`;
            alert(msg);
            loginBtn.disabled = false;
            loginLoading.style.display = 'none';
            return false;
        }

        if (!data || !data.apiKey) {
            alert('Admin API key not returned by server. Check server configuration.');
            loginBtn.disabled = false;
            loginLoading.style.display = 'none';
            return false;
        }

        localStorage.setItem('adminApiKey', data.apiKey);
        localStorage.setItem('adminUsername', username);
        window.location.href = '../admin/dashboard.html';

    } catch (err) {
        console.error(err);
        alert(`Network error: ${err.message || 'Unable to reach admin service'}`);
        loginBtn.disabled = false;
        loginLoading.style.display = 'none';
    }

    return false;
}

function togglePassword() {
    const passwordInput = document.adminLogin.password;
    const toggle = document.querySelector('.password-toggle');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggle.textContent = '🙈';
        toggle.title = 'Hide password';
    } else {
        passwordInput.type = 'password';
        toggle.textContent = '👁';
        toggle.title = 'Show password';
    }
}
