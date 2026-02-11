var _toastContainer = null;

function showToast(message, type, icon) {
  type = type || '';
  icon = icon || '\u2139\uFE0F';

  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }

  // Limit to 3 visible toasts - remove oldest
  while (_toastContainer.children.length >= 3) {
    _toastContainer.removeChild(_toastContainer.firstChild);
  }

  var toast = document.createElement('div');
  toast.className = 'toast toast-enter ' + type;
  toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-message">' + message + '</span>';
  toast.onclick = function() { _dismissToast(toast); };

  _toastContainer.appendChild(toast);

  toast._timeout = setTimeout(function() { _dismissToast(toast); }, 3000);
}

function _dismissToast(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;
  if (toast._timeout) clearTimeout(toast._timeout);
  toast.classList.remove('toast-enter');
  toast.classList.add('toast-exit');
  setTimeout(function() {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}
