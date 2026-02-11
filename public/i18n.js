/**
 * eLink Internationalization (i18n) + Currency System
 * Supports: English (en), Macedonian (mk)
 * Currencies: EUR, MKD
 */

const TRANSLATIONS = {
  en: {
    // Header
    'ev_charging': 'EV Charging',
    'loading': 'Loading...',
    'connecting': 'Connecting...',
    'connected': 'Connected',
    'disconnected': 'Disconnected',

    // Navigation
    'map': 'Map',
    'search': 'Search',

    // Search
    'search_stations': 'Search stations...',

    // Station Panel
    'power_output': 'Power Output',
    'connector_type': 'Connector Type',
    'address': 'Address',
    'price_per_kwh': 'Price per kWh',
    'type2_ac': 'Type 2 AC',

    // Charging
    'start_charging': 'Start Charging',
    'stop_charging': 'Stop Charging',
    'navigate': 'Navigate',
    'power': 'Power',
    'energy': 'Energy',
    'duration': 'Duration',
    'estimated_cost': 'Estimated Cost',
    'battery_level': 'Battery Level',
    'charging_in_progress': 'Charging in progress...',
    'technical_data': 'Technical Data',
    'voltage': 'Voltage',
    'current': 'Current',
    'temperature': 'Temperature',
    'max_power': 'Max Power',
    'data_age': 'Data Age',

    // Payment Modal
    'payment': 'Payment',
    'secure_payment': 'Secure payment powered by eLink',
    'card_number': 'Card Number',
    'expiry_date': 'Expiry Date',
    'security_code': 'Security Code',
    'authorize_start': 'Authorize & Start Charging',
    'processing': 'Processing...',
    'cards_accepted': 'Visa, Mastercard, and Maestro accepted',

    // Session Summary
    'session_complete': 'Session Complete',
    'charging_complete': 'Charging Complete!',
    'thank_you': 'Thank you for charging with elink',
    'energy_delivered': 'Energy Delivered',
    'charging_duration': 'Charging Duration',
    'average_power': 'Average Power',
    'total_cost': 'Total Cost',
    'done': 'Done',

    // Status
    'available': 'Available',
    'charging': 'Charging',
    'offline': 'Offline',
    'preparing': 'Preparing',
    'suspended': 'Suspended',
    'finishing': 'Finishing',
    'reserved': 'Reserved',
    'faulted': 'Faulted',

    // Login
    'welcome_back': 'Welcome Back',
    'email': 'Email',
    'password': 'Password',
    'sign_in': 'Sign In',
    'signing_in': 'Signing in...',
    'forgot_password': 'Forgot your password?',
    'no_account': "Don't have an account?",
    'sign_up': 'Sign up',

    // Register
    'create_account': 'Create Account',
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'create_password': 'Create a password',
    'password_hint': 'Min 8 chars, 1 uppercase, 1 number',
    'creating_account': 'Creating account...',
    'account_created': 'Account Created!',
    'check_email': 'You can now sign in with your account.',
    'go_to_login': 'Go to Login',
    'have_account': 'Already have an account?',

    // Profile
    'profile': 'Profile',
    'charging_history': 'Charging History',
    'wallet': 'Wallet',
    'balance': 'Balance',
    'top_up': 'Top Up',
    'logout': 'Log Out',

    // Forgot Password
    'reset_password': 'Reset Password',
    'enter_email': 'Enter your email address',
    'send_reset': 'Send Reset Link',
    'back_to_login': 'Back to Login',

    // Errors
    'network_error': 'Network error. Please try again.',
    'login_failed': 'Login failed',
    'registration_failed': 'Registration failed',
    'station_not_found': 'Station not found',
    'charger_offline': 'Charger is offline',

    // Connection Phase
    'connecting_to_charger': 'Connecting to charger...',
    'please_wait': 'Please wait',
    'plug_in_vehicle': 'Plug in your vehicle',
    'waiting_for_plug': 'Waiting for plug connection...',
    'plug_detected': 'Plug detected!',
    'initializing_session': 'Initializing charging session...',
    'charging_started': 'Charging started!',
    'start_failed': 'Failed to start charging',
    'cost': 'Cost',
    'awaiting_car_connection': 'Awaiting Car Connection',
    'please_plug_in': 'Please plug in your vehicle',
    'vehicle_now_charging': 'Your vehicle is now charging',
    'connection_timed_out': 'Connection Timed Out',
    'no_vehicle_detected': 'No vehicle detected. Please try again.',

    // Reservation
    'reserve': 'Reserve',
    'reserve_30_min': 'Reserve (30 min)',
    'reserve_charger': 'Reserve Charger',
    'reserve_description': 'Reserve this charger for 30 minutes starting now. No one else can start a session during your reservation.',
    'reserve_for_30': 'Reserve for 30 Minutes',
    'one_active_reservation': 'You can only have 1 active reservation at a time',
    'reserving': 'Reserving...',
    'reserved_success': 'Reserved for 30 minutes!',
    'station_in_use': 'Station is currently in use',
    'failed_to_reserve': 'Failed to reserve',
    'cancel': 'Cancel',
    'cancel_reservation': 'Cancel this reservation?',
    'failed_cancel_reservation': 'Failed to cancel reservation',

    // Profile / Wallet
    'my_reservations': 'My Reservations',
    'no_reservations': 'No reservations yet',
    'recent_transactions': 'Recent Transactions',
    'no_transactions': 'No transactions yet',
    'no_charging_sessions': 'No charging sessions yet',
    'charger': 'Charger',
    'in_progress': 'In progress',
    'add_funds': 'Add Funds',
    'select_amount': 'Select Amount',
    'pay_now': 'Pay Now',
    'secure_payment_demo': 'Secure Payment (Demo)',
    'top_up_amount': 'Top up',
    'payment_successful': 'Payment successful!',
    'payment_failed_retry': 'Payment failed. Please try again.',
    'top_up_label': 'Top Up',
    'charging_payment': 'Charging Payment',
    'admin': 'Admin',
    'admin_panel_link': 'Admin Panel — Manage stations & users',
    'back_to_map': 'Map',

    // Charging actions
    'stopping': 'Stopping...',
    'charging_stopped': 'Charging stopped',
    'failed_to_stop': 'Failed to stop',
    'connection_error': 'Connection error',
    'not_available': 'Not Available',
    'payment_authorized': 'Payment authorized',
    'payment_error': 'Payment error',

    // Search
    'no_stations_found': 'No stations found',

    // Status labels
    'status_active': 'Active',
    'status_ready_plug': 'Ready - Plug Connected',
    'status_paused': 'Paused',
    'status_error': 'Error',
    'status_finishing': 'Finishing...',

    // UX improvements
    'location_unavailable': 'Location unavailable. Please enable location services.',
    'confirm_stop': 'Stop Charging?',
    'confirm_stop_desc': 'Are you sure you want to stop this charging session?',
    'data_may_be_outdated': 'Connection lost. Data may be outdated.',
    'reconnecting': 'Reconnecting...',

    // Payment validation
    'invalid_card_number': 'Please enter a valid 16-digit card number',
    'invalid_expiry': 'Please enter a valid expiry date (MM/YY)',
    'invalid_cvv': 'Please enter a valid security code',

    // Forgot password
    'enter_new_password': 'Enter your new password',
    'sending': 'Sending...',
    'check_your_email': 'Check Your Email',
    'reset_email_sent': 'If an account exists with that email, we\'ve sent password reset instructions.',
    'passwords_no_match': 'Passwords do not match',
    'password_min_length': 'Password must be at least 8 characters',
    'resetting': 'Resetting...',
    'password_reset_done': 'Password Reset!',
    'password_updated': 'Your password has been updated successfully.',
    'sign_in_now': 'Sign in now',
    'reset_failed': 'Reset failed. The link may have expired.',
  },

  mk: {
    // Header
    'ev_charging': 'EV Полнење',
    'loading': 'Вчитување...',
    'connecting': 'Поврзување...',
    'connected': 'Поврзано',
    'disconnected': 'Прекинато',

    // Navigation
    'map': 'Мапа',
    'search': 'Пребарај',

    // Search
    'search_stations': 'Пребарај станици...',

    // Station Panel
    'power_output': 'Моќност',
    'connector_type': 'Тип на приклучок',
    'address': 'Адреса',
    'price_per_kwh': 'Цена по kWh',
    'type2_ac': 'Тип 2 AC',

    // Charging
    'start_charging': 'Започни полнење',
    'stop_charging': 'Прекини полнење',
    'navigate': 'Навигирај',
    'power': 'Моќност',
    'energy': 'Енергија',
    'duration': 'Траење',
    'estimated_cost': 'Проценета цена',
    'battery_level': 'Ниво на батерија',
    'charging_in_progress': 'Полнење во тек...',
    'technical_data': 'Технички податоци',
    'voltage': 'Напон',
    'current': 'Струја',
    'temperature': 'Температура',
    'max_power': 'Макс. моќност',
    'data_age': 'Старост на подат.',

    // Payment Modal
    'payment': 'Плаќање',
    'secure_payment': 'Безбедно плаќање преку eLink',
    'card_number': 'Број на картичка',
    'expiry_date': 'Датум на истек',
    'security_code': 'Безбедносен код',
    'authorize_start': 'Авторизирај и започни',
    'processing': 'Обработка...',
    'cards_accepted': 'Се прифаќаат Visa, Mastercard и Maestro',

    // Session Summary
    'session_complete': 'Сесија завршена',
    'charging_complete': 'Полнењето е завршено!',
    'thank_you': 'Ви благодариме што полните со elink',
    'energy_delivered': 'Испорачана енергија',
    'charging_duration': 'Траење на полнење',
    'average_power': 'Просечна моќност',
    'total_cost': 'Вкупна цена',
    'done': 'Готово',

    // Status
    'available': 'Достапна',
    'charging': 'Полни',
    'offline': 'Офлајн',
    'preparing': 'Подготвува',
    'suspended': 'Паузирано',
    'finishing': 'Завршува',
    'reserved': 'Резервирана',
    'faulted': 'Дефект',

    // Login
    'welcome_back': 'Добредојдовте',
    'email': 'Е-пошта',
    'password': 'Лозинка',
    'sign_in': 'Најави се',
    'signing_in': 'Најавување...',
    'forgot_password': 'Ја заборавивте лозинката?',
    'no_account': 'Немате сметка?',
    'sign_up': 'Регистрирај се',

    // Register
    'create_account': 'Креирај сметка',
    'first_name': 'Име',
    'last_name': 'Презиме',
    'create_password': 'Креирај лозинка',
    'password_hint': 'Мин 8 знаци, 1 голема буква, 1 број',
    'creating_account': 'Креирање сметка...',
    'account_created': 'Сметката е креирана!',
    'check_email': 'Сега можете да се најавите.',
    'go_to_login': 'Кон најава',
    'have_account': 'Веќе имате сметка?',

    // Profile
    'profile': 'Профил',
    'charging_history': 'Историја на полнење',
    'wallet': 'Паричник',
    'balance': 'Салдо',
    'top_up': 'Дополни',
    'logout': 'Одјави се',

    // Forgot Password
    'reset_password': 'Ресетирај лозинка',
    'enter_email': 'Внесете ја вашата е-пошта',
    'send_reset': 'Испрати линк',
    'back_to_login': 'Назад кон најава',

    // Errors
    'network_error': 'Мрежна грешка. Обидете се повторно.',
    'login_failed': 'Најавата не успеа',
    'registration_failed': 'Регистрацијата не успеа',
    'station_not_found': 'Станицата не е пронајдена',
    'charger_offline': 'Полначот е офлајн',

    // Connection Phase
    'connecting_to_charger': 'Поврзување со полначот...',
    'please_wait': 'Ве молиме почекајте',
    'plug_in_vehicle': 'Приклучете го возилото',
    'waiting_for_plug': 'Чекање на приклучок...',
    'plug_detected': 'Приклучок детектиран!',
    'initializing_session': 'Иницијализација на сесија...',
    'charging_started': 'Полнењето започна!',
    'start_failed': 'Неуспешно започнување',
    'cost': 'Цена',
    'awaiting_car_connection': 'Чекање на возило',
    'please_plug_in': 'Ве молиме приклучете го возилото',
    'vehicle_now_charging': 'Вашето возило сега се полни',
    'connection_timed_out': 'Времето истече',
    'no_vehicle_detected': 'Не е детектирано возило. Обидете се повторно.',

    // Reservation
    'reserve': 'Резервирај',
    'reserve_30_min': 'Резервирај (30 мин)',
    'reserve_charger': 'Резервирај полнач',
    'reserve_description': 'Резервирајте го овој полнач за 30 минути од сега. Никој друг не може да започне сесија за време на вашата резервација.',
    'reserve_for_30': 'Резервирај за 30 минути',
    'one_active_reservation': 'Можете да имате само 1 активна резервација',
    'reserving': 'Резервирање...',
    'reserved_success': 'Резервирано за 30 минути!',
    'station_in_use': 'Станицата е во употреба',
    'failed_to_reserve': 'Неуспешна резервација',
    'cancel': 'Откажи',
    'cancel_reservation': 'Откажи ја оваа резервација?',
    'failed_cancel_reservation': 'Неуспешно откажување на резервацијата',

    // Profile / Wallet
    'my_reservations': 'Мои резервации',
    'no_reservations': 'Нема резервации',
    'recent_transactions': 'Последни трансакции',
    'no_transactions': 'Нема трансакции',
    'no_charging_sessions': 'Нема сесии на полнење',
    'charger': 'Полнач',
    'in_progress': 'Во тек',
    'add_funds': 'Додај средства',
    'select_amount': 'Избери износ',
    'pay_now': 'Плати сега',
    'secure_payment_demo': 'Безбедно плаќање (Демо)',
    'top_up_amount': 'Дополни',
    'payment_successful': 'Плаќањето е успешно!',
    'payment_failed_retry': 'Плаќањето не успеа. Обидете се повторно.',
    'top_up_label': 'Дополнување',
    'charging_payment': 'Плаќање за полнење',
    'admin': 'Админ',
    'admin_panel_link': 'Админ панел — Управувај станици и корисници',
    'back_to_map': 'Мапа',

    // Charging actions
    'stopping': 'Запирање...',
    'charging_stopped': 'Полнењето е запрено',
    'failed_to_stop': 'Неуспешно запирање',
    'connection_error': 'Грешка во конекција',
    'not_available': 'Не е достапно',
    'payment_authorized': 'Плаќањето е авторизирано',
    'payment_error': 'Грешка при плаќање',

    // Search
    'no_stations_found': 'Не се пронајдени станици',

    // Status labels
    'status_active': 'Активна',
    'status_ready_plug': 'Готов - Приклучок поврзан',
    'status_paused': 'Паузирано',
    'status_error': 'Грешка',
    'status_finishing': 'Завршува...',

    // UX improvements
    'location_unavailable': 'Локацијата не е достапна. Вклучете ги локациските услуги.',
    'confirm_stop': 'Прекини полнење?',
    'confirm_stop_desc': 'Дали сте сигурни дека сакате да го прекинете полнењето?',
    'data_may_be_outdated': 'Конекцијата е изгубена. Податоците може да се застарени.',
    'reconnecting': 'Повторно поврзување...',

    // Payment validation
    'invalid_card_number': 'Внесете валиден 16-цифрен број на картичка',
    'invalid_expiry': 'Внесете валиден датум на истек (MM/YY)',
    'invalid_cvv': 'Внесете валиден безбедносен код',

    // Forgot password
    'enter_new_password': 'Внесете нова лозинка',
    'sending': 'Испраќање...',
    'check_your_email': 'Проверете ја е-поштата',
    'reset_email_sent': 'Ако постои сметка со таа е-пошта, испративме инструкции за ресетирање.',
    'passwords_no_match': 'Лозинките не се совпаѓаат',
    'password_min_length': 'Лозинката мора да има најмалку 8 знаци',
    'resetting': 'Ресетирање...',
    'password_reset_done': 'Лозинката е ресетирана!',
    'password_updated': 'Вашата лозинка е успешно ажурирана.',
    'sign_in_now': 'Најавете се сега',
    'reset_failed': 'Ресетирањето не успеа. Линкот можеби е истечен.',
  }
};

// Currency configuration
const CURRENCIES = {
  EUR: { symbol: '\u20AC', code: 'EUR', rate: 1 },
  MKD: { symbol: 'ден', code: 'MKD', rate: 61.5 }
};

// State
let currentLang = localStorage.getItem('elink_lang') || 'en';
let currentCurrency = localStorage.getItem('elink_currency') || 'EUR';

/**
 * Get translated string
 */
function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ||
         TRANSLATIONS.en[key] || key;
}

/**
 * Format price in selected currency
 */
function formatPrice(amountEur) {
  const curr = CURRENCIES[currentCurrency];
  const converted = amountEur * curr.rate;
  if (currentCurrency === 'MKD') {
    return `${converted.toFixed(0)} ${curr.symbol}`;
  }
  return `${curr.symbol}${converted.toFixed(2)}`;
}

/**
 * Format price per kWh
 */
function formatPricePerKwh(amountEur) {
  const curr = CURRENCIES[currentCurrency];
  const converted = amountEur * curr.rate;
  if (currentCurrency === 'MKD') {
    return `${converted.toFixed(1)} ${curr.symbol}/kWh`;
  }
  return `${curr.symbol}${converted.toFixed(2)}/kWh`;
}

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translated;
    } else {
      el.textContent = translated;
    }
  });
}

/**
 * Set language and apply
 */
function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('elink_lang', lang);
  applyTranslations();
  updateToggleUI();
}

/**
 * Set currency and refresh displays
 */
function setCurrency(currency) {
  if (!CURRENCIES[currency]) return;
  currentCurrency = currency;
  localStorage.setItem('elink_currency', currency);
  updateToggleUI();
}

/**
 * Toggle between languages
 */
function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'mk' : 'en');
}

/**
 * Toggle between currencies
 */
function toggleCurrency() {
  setCurrency(currentCurrency === 'EUR' ? 'MKD' : 'EUR');
}

/**
 * Update toggle button labels
 */
function updateToggleUI() {
  const langBtn = document.getElementById('langToggle');
  if (langBtn) {
    langBtn.textContent = currentLang === 'en' ? 'MK' : 'EN';
    langBtn.title = currentLang === 'en' ? 'Switch to Macedonian' : 'Switch to English';
  }
  const currBtn = document.getElementById('currencyToggle');
  if (currBtn) {
    currBtn.textContent = currentCurrency === 'EUR' ? 'MKD' : 'EUR';
    currBtn.title = currentCurrency === 'EUR' ? 'Switch to MKD' : 'Switch to EUR';
  }
}

// Auto-apply translations on page load
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  updateToggleUI();
});
