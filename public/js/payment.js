var _paymentTrigger = null;

function showPayment() {
  _paymentTrigger = document.activeElement;
  var modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.remove('hidden');
    trapFocus(modal);
  }
}

function closePayment() {
  var modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.add('hidden');
    releaseFocus(modal, _paymentTrigger);
  }
  var cardNum = document.getElementById('cardNumber');
  var cardExpiry = document.getElementById('cardExpiry');
  var cardCvv = document.getElementById('cardCvv');
  if (cardNum) cardNum.value = '';
  if (cardExpiry) cardExpiry.value = '';
  if (cardCvv) cardCvv.value = '';
}

async function processPayment() {
  var cardNumber = (document.getElementById('cardNumber') || {}).value;
  var expiry = (document.getElementById('cardExpiry') || {}).value;
  var cvv = (document.getElementById('cardCvv') || {}).value;
  var cardError = document.getElementById('cardError');

  var digits = (cardNumber || '').replace(/\s/g, '');
  if (digits.length < 16) {
    if (cardError) { cardError.textContent = t('invalid_card_number'); cardError.style.display = 'block'; }
    return;
  }
  if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
    if (cardError) { cardError.textContent = t('invalid_expiry'); cardError.style.display = 'block'; }
    return;
  }
  if (!cvv || cvv.length < 3) {
    if (cardError) { cardError.textContent = t('invalid_cvv'); cardError.style.display = 'block'; }
    return;
  }
  if (cardError) cardError.style.display = 'none';

  var payBtn = document.getElementById('payBtn');
  var payBtnText = document.getElementById('payBtnText');
  if (payBtn) { payBtn.disabled = true; if (payBtnText) payBtnText.textContent = t('processing'); }

  try {
    var response = await fetch('/api/payment/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardNumber: cardNumber, expiry: expiry, cvv: cvv })
    });
    var result = await response.json();
    if (result.success) {
      showToast(t('payment_authorized'), 'success', '\u2705');
      closePayment();
      await startCharging(result.token);
    } else {
      showToast(result.message || t('payment_error'), 'error', '\u274C');
    }
  } catch (error) {
    showToast(t('payment_error'), 'error', '\u274C');
    console.error(error);
  } finally {
    if (payBtn) { payBtn.disabled = false; if (payBtnText) payBtnText.textContent = t('authorize_start'); }
  }
}

function detectCardBrand(number) {
  var n = number.replace(/\s/g, '');
  if (/^4/.test(n)) return { brand: 'visa', icon: '' };
  if (/^5[1-5]/.test(n)) return { brand: 'mastercard', icon: '' };
  if (/^(6304|6759|6761|6762|6763)/.test(n)) return { brand: 'maestro', icon: '' };
  return { brand: '', icon: '' };
}

function setupCardFormatting() {
  var cardInput = document.getElementById('cardNumber');
  if (cardInput) {
    cardInput.addEventListener('input', function(e) {
      var value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
      var formatted = '';
      for (var i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
      }
      e.target.value = formatted;
      var brandEl = document.getElementById('cardBrandIcon');
      if (brandEl) {
        var info = detectCardBrand(value);
        if (info.brand === 'visa') brandEl.textContent = 'VISA';
        else if (info.brand === 'mastercard') brandEl.textContent = 'MC';
        else if (info.brand === 'maestro') brandEl.textContent = 'MST';
        else brandEl.textContent = '';
        brandEl.style.fontWeight = '700';
        brandEl.style.fontSize = info.brand ? '14px' : '24px';
        brandEl.style.color = info.brand === 'visa' ? '#1a1f71' : info.brand === 'mastercard' ? '#eb001b' : '#0099df';
      }
      var errEl = document.getElementById('cardError');
      if (errEl) errEl.style.display = 'none';
    });
  }
  var expiryInput = document.getElementById('cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      var value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) value = value.substring(0, 2) + '/' + value.substring(2, 4);
      e.target.value = value;
    });
  }
}
