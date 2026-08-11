
const apiBase = `http://${window.location.hostname}:3000/api/vouchers`

async function handleLogin(event) {
    event.preventDefault();

    const username = document.login.username.value.trim();
    const loginBtn = document.getElementById("loginBtn");
    const loginLoading = document.getElementById("loginLoading");

    console.log(username);
    console.log(password);

    if (!username) {
        alert("Please enter your voucher code.");
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
            body: JSON.stringify({ hotspot_username: username }),
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



