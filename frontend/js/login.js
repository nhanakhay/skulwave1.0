
const apiBase = `${window.location.protocol}//${window.location.hostname}:3000/api/vouchers/redeem`;





async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('vUsername');
    const loginBtn = document.getElementById("vLoginBtn");
    const loginLoading = document.getElementById("vLoginLoading");

    const username = usernameInput?.value?.trim() || "";
    const password = 'skulwave';

    if (!username) {
        alert("Please enter your Voucher.");
        return false;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginLoading.style.display = "block";

    try {
        const response = await fetch(apiBase, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ hotspot_username: username, hotspot_password: password }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            loginBtn.disabled = false;
            loginLoading.style.display = "none";
            alert(data.error || "Server Error, contact Administrator in the IT Lab(Sir Theophilus).");
            return false;
        }

        // On successful redeem, go to status page which shows connectivity.
        window.location.href = "status.html";
        return false;
    } catch (err) {
        console.error(err);
        loginBtn.disabled = false;
        loginLoading.style.display = "none";
        alert("Server Error, contact Administrator in the IT");
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

