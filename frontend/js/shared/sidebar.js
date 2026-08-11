(function () {
  const page = document.body.dataset.page || 'dashboard';
  const items = [['dashboard','Overview','dashboard.html'],['generate-vouchers','Generate vouchers','generate-vouchers.html'],['users','Users','users.html'],['sessions','Sessions','sessions.html'],['revenue','Revenue','revenue.html'],['analytics','Analytics','analytics.html'],['packages-admin','Packages','packages.html'],['resellers','Resellers','resellers.html']];
  const label = items.find((item) => item[0] === page)?.[1] || 'Admin';
  document.getElementById('adminLayout').innerHTML = `<aside class="sidebar"><div class="brand"><b class="brand-mark">S</b><span>SkulWave</span></div><div class="nav-label">Administration</div><nav class="admin-nav">${items.map(([id,text,href]) => `<a href="${href}" class="${id===page?'active':''}"><span class="nav-icon">•</span><span>${text}</span></a>`).join('')}</nav></aside><main class="admin-main"><header class="topbar"><h1 class="page-title">${label}</h1><div class="admin-account"><span>${localStorage.getItem('adminUsername')||'Admin'}</span><button id="adminLogout" type="button">Log out</button></div></header><section class="content" id="adminContent"></section></main>`;
  document.getElementById('adminLogout').onclick=()=>{localStorage.removeItem('adminApiKey');localStorage.removeItem('adminUsername');location.href='adminlogin.html';};
})();
