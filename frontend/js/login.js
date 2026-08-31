const apiBase = `${window.location.protocol}//${window.location.host}/api/vouchers/redeem`;

// const apiBase = "/api/vouchers/redeem"

const query = new URLSearchParams(window.location.search);
const routerLoginUrl = query.get("router-login");
const originalDestination = query.get("dst");

async function handlePaymentAccount(event) {
  event.preventDefault();
  const form = event.currentTarget,
    button = document.getElementById("paymentAccountButton"),
    loading = document.getElementById("paymentAccountLoading");
  button.disabled = true;
  loading.style.display = "block";
  try {
    const response = await fetch("/api/payment/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to continue.");
    sessionStorage.setItem("skulwaveAccountToken", data.account_token);
    location.href = `packages.html?dst=${encodeURIComponent(originalDestination || "")}&router-login=${encodeURIComponent(routerLoginUrl || "")}`;
  } catch (err) {
    alert(err.message);
    button.disabled = false;
    loading.style.display = "none";
  }
  return false;
}

async function handleLogin(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("vUsername");
  const vFullNameInput =
    document.getElementById("vFullName") ||
    document.getElementById("vFullname");
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
      body: JSON.stringify({
        hotspot_username: username,
        vFullname: buyerFullName,
        buyer_full_name: buyerFullName,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      loginBtn.disabled = false;
      loginLoading.style.display = "none";
      alert(
        data.error ||
          "Server Error, contact Administrator in the IT Lab(Sir Theophilus).",
      );
      return false;
    }

    const voucher = data?.voucher || {};
    const routerLoginForm = document.getElementById("routerLoginForm");

    // if (!routerLoginForm || !routerLoginUrl) {
    //   throw new Error(
    //     "Router login URL is missing. Update the router redirect login.html.",
    //   );
    // }

    //this ensures the user is told to rather go through the right channel to login 
    //instead of throwing an error

       if (!routerLoginForm || !routerLoginUrl) {
      loginBtn.disabled = false;
      loginLoading.style.display = "none";
      alert(
        "Your voucher was redeemed, but we couldn't reach the router automatically.\n\n" +
        "Please reconnect to the SkulWave Wifi network and tap it again to finish connecting."
      );
      return false;
    }

    routerLoginForm.action = routerLoginUrl;
    routerLoginForm.elements.username.value = voucher.username || username;
    routerLoginForm.elements.password.value = voucher.password || "";
    routerLoginForm.elements.dst.value =
      originalDestination ||
      `${window.location.protocol}//${window.location.host}/status.html`;

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
