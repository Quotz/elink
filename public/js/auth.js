function initAuth() {
  var userStr = localStorage.getItem('user');
  if (userStr) currentUser = JSON.parse(userStr);
  updateAuthUI();
}

function updateAuthUI() {
  var headerRight = document.querySelector('.header-right');
  if (!headerRight) return;
  var existingMenu = document.getElementById('userMenu');
  if (existingMenu) existingMenu.remove();

  var userMenu = document.createElement('div');
  userMenu.id = 'userMenu';
  userMenu.className = 'user-menu';

  if (currentUser) {
    var adminLink = currentUser.role === 'admin'
      ? '<a href="/admin.html" class="dropdown-item">\u2699\uFE0F Admin Panel</a>'
      : '';
    userMenu.innerHTML =
      '<button class="user-menu-btn" onclick="toggleUserMenu()">' +
        '<span class="user-avatar">' + ((currentUser.firstName && currentUser.firstName[0]) || currentUser.email[0]).toUpperCase() + '</span>' +
        '<span class="user-name">' + (currentUser.firstName || 'User') + '</span>' +
        '<span class="dropdown-icon">\u25BC</span>' +
      '</button>' +
      '<div class="user-dropdown hidden" id="userDropdown">' +
        '<a href="/profile.html" class="dropdown-item">\uD83D\uDC64 Profile & Wallet</a>' +
        adminLink +
        '<div class="dropdown-divider"></div>' +
        '<div class="dropdown-item" style="gap:10px;cursor:default">' +
          '<button class="toggle-btn" id="langToggle" onclick="event.stopPropagation();toggleLanguage()">MK</button>' +
          '<button class="toggle-btn" id="currencyToggle" onclick="event.stopPropagation();toggleCurrency()">MKD</button>' +
        '</div>' +
        '<div class="dropdown-divider"></div>' +
        '<button class="dropdown-item" onclick="logout()">\uD83D\uDEAA Logout</button>' +
      '</div>';
  } else {
    userMenu.innerHTML = '<button class="btn btn-login" onclick="window.location.href=\'/login.html\'">Sign In</button>';
  }
  headerRight.appendChild(userMenu);

  var profileLabel = document.getElementById('navProfileLabel');
  if (profileLabel) profileLabel.textContent = currentUser ? t('profile') : t('sign_in');
  if (typeof updateToggleUI === 'function') updateToggleUI();
}

function toggleUserMenu() {
  var dropdown = document.getElementById('userDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.user-menu')) {
    var dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

// Bottom Navigation
function navMap() {
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('navMapBtn').classList.add('active');
  closePanel();
  var searchBar = document.getElementById('searchBar');
  if (searchBar) searchBar.style.display = '';
  var searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.classList.add('hidden');
}

function navSearch() {
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('navSearchBtn').classList.add('active');
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    var searchBar = document.getElementById('searchBar');
    if (searchBar) searchBar.style.display = '';
    searchInput.focus();
  }
}

function navProfile() {
  if (currentUser) window.location.href = '/profile.html';
  else window.location.href = '/login.html';
}

function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.reload();
}
