
const apiBase = `${window.location.protocol}//${window.location.hostname}/api/vouchers/redeem`;

const query = new URLSearchParams(window.location.search);
const routerLoginUrl = query.get('router-login');
const originalDestination = query.get('dst');




async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('vUsername');
    const vFullNameInput = document.getElementById('vFullName') || document.getElementById('vFullname');
    const loginBtn = document.getElementById("vLoginBtn");
    const loginLoading = document.getElementById("vLoginLoading");

    const username = usernameInput?.value?.trim() || "";
    const buyerFullName = vFullNameInput?.value?.trim() || "";

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
            body: JSON.stringify({ hotspot_username: username, vFullname: buyerFullName, buyer_full_name: buyerFullName }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            loginBtn.disabled = false;
            loginLoading.style.display = "none";
            alert(data.error || "Server Error, contact Administrator in the IT Lab(Sir Theophilus).");
            return false;
        }

        const voucher = data?.voucher || {};
        const routerLoginForm = document.getElementById('routerLoginForm');

        if (!routerLoginForm || !routerLoginUrl) {
            throw new Error('Router login URL is missing. Update the router redirect login.html.');
        }

        routerLoginForm.action = routerLoginUrl;
        routerLoginForm.elements.username.value = voucher.username || username;
        routerLoginForm.elements.password.value = voucher.password || '';
        routerLoginForm.elements.dst.value = originalDestination || `${window.location.protocol}//${window.location.host}/status.html`;

        // This navigation is essential. A fetch request can look successful even
        // when RouterOS rejects the credentials, and it does not prove a Hotspot
        // session was created.
        routerLoginForm.submit();
        return false;
    } catch (err) {
        console.error(err);
        loginBtn.disabled = false;
        loginLoading.style.display = "none";
        alert("Server Error, contact Administrator in the IT");
        return false;
    }
}



