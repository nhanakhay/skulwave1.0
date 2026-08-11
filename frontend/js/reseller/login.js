document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try {
    const r = await fetch("/api/resellers/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    localStorage.setItem("resellerToken", d.token);
    localStorage.setItem("resellerName", d.reseller.name);
    location.href = "dashboard.html";
  } catch (x) {
    alert(x.message);
  }
};
