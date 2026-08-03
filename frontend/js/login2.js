
const apiBase = `http://${window.location.hostname}:3000/api/vouchers`

async function handleLogin(event) {
    event.preventDefault();

    const username = document.login.username.value.trim();
    const password = document.login.password.value.trim();
    const loginBtn = document.getElementById("loginBtn");
    const loginLoading = document.getElementById("loginLoading");

    console.log(username);
    console.log(password);

    if (!username || !password) {
        alert("Please enter both username and password.");
        return false;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginLoading.style.display = "block";

    try {
        const response = await fetch(`${apiBase}/redeem`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ hotspot_username: username, hotspot_password: password }),
        });

        const data = await response.json();

        if (!response.ok) {
            loginBtn.disabled = false;
            loginLoading.style.display = "none";
            alert(data.error || "Server Error, contact Administrator in the IT Lab(Sir Theo).");
            return false;
        }

        // On successful redeem, go to status page which shows connectivity.
        window.location.href = "status.html";
        return false;
    } catch (err) {
        console.error(err);
        loginBtn.disabled = false;
        loginLoading.style.display = "none";
        alert("Unable to reach login service. Please try again later.");
        return false;
    }
}

function doLogin() {
    document.sendin.username.value = document.login.username.value;
    document.sendin.password.value = hexMD5('$(chap-id)' + document.login.password.value + '$(chap-challenge)');
    document.sendin.submit();
    return false;
}

function togglePassword() {
    const passwordInput = document.login.password;
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

