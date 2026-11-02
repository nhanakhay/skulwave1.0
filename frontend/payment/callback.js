(async () => {
  const message = document.getElementById("message"),
    params = new URLSearchParams(location.search),
    reference = params.get("reference");
  if (!reference) {
    message.textContent = "No payment reference was supplied.";
    return;
  }
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
        signal: controller.signal,
      }),
      d = await r.json().catch(() => ({}));
    clearTimeout(timeout);
    if (!r.ok)
      throw new Error(
        d.error ||
          "Payment confirmation is temporarily unavailable. Please try again.",
      );
    message.textContent = "Payment confirmed. Connecting you now…";
    const form = document.getElementById("routerLoginForm"),
      routerLogin = params.get("router-login");
    if (routerLogin) {
      form.action = routerLogin;
      form.elements.username.value = d.username;
      form.elements.password.value = d.password;
      form.elements.dst.value = params.get("dst") || "/status.html";
      form.submit();
    } else
      message.textContent = `Payment confirmed. Your Wi-Fi username is ${d.username}. Return to the hotspot login page to connect.`;
  } catch (e) {
    clearTimeout(timeout);
    message.textContent =
      e.name === "AbortError"
        ? "The router is busy or temporarily unreachable. Your payment may still be processing; please wait a moment and try again."
        : e.message;
  }
})();
