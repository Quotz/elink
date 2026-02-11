function showToast(message, type, icon) {
  type = type || '';
  icon = icon || 'ℹ️';
  var toast = document.getElementById('toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast hidden';
    toast.innerHTML = '<span class="toast-icon"></span><span id="toastMessage"></span>';
    document.body.appendChild(toast);
  }

  var toastMessage = document.getElementById('toastMessage') || toast.querySelector('span:last-child');
  var toastIcon = toast.querySelector('.toast-icon');

  if (toastIcon) toastIcon.textContent = icon;
  if (toastMessage) toastMessage.textContent = message;

  toast.className = 'toast ' + type;

  setTimeout(function() {
    toast.classList.add('hidden');
  }, 3000);
}
