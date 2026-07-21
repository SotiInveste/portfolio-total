// ============================================================
// Global state + calculation helpers
// ============================================================

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// State — loaded from Supabase on login
const state = {
  types:    [],  // account_types rows
  accounts: [],  // accounts rows
  records:  [],  // monthly_records rows
};

let mesAtual = new Date();
mesAtual.setDate(1);

// ── Type helpers ──────────────────────────────────────────

function getType(id) {
  return state.types.find(t => t.id === id) || { id, label: id, color: '#888780', track_rent: false, track_div: false };
}
function trackRent(typeId) { return !!getType(typeId).track_rent; }
function trackDiv(typeId)  { return !!getType(typeId).track_div; }

function badgeStyle(typeId) {
  const c = getType(typeId).color;
  return `background:${c}22;color:${c}`;
}

// ── Date helpers ──────────────────────────────────────────

function mesKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function mesDisplay(d) {
  return MESES[d.getMonth()] + ' ' + d.getFullYear();
}

// ── Format helpers ────────────────────────────────────────

function fmt(v, currency = 'EUR') {
  const sym = { EUR: '€', USD: '$', GBP: '£', BTC: '₿' };
  if (currency === 'BTC') return '₿' + parseFloat(v).toFixed(4);
  return parseFloat(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    + ' ' + (sym[currency] || currency);
}
function fmtPct(p) { return (p >= 0 ? '+' : '') + parseFloat(p).toFixed(2) + '%'; }
function rentClass(p) { return p > 0 ? 'rent-pos' : p < 0 ? 'rent-neg' : 'rent-neu'; }

// ── Record helpers ────────────────────────────────────────

function getRecord(accountId, month) {
  return state.records.find(r => r.account_id === accountId && r.month === month);
}

function getValue(accountId, month) {
  return parseFloat(getRecord(accountId, month)?.value || 0);
}
function getTopUp(accountId, month) {
  return parseFloat(getRecord(accountId, month)?.top_up || 0);
}
function getDividends(accountId, month) {
  return parseFloat(getRecord(accountId, month)?.dividends || 0);
}

// Invested total up to and including a given month
function investedUpTo(account, upToMonth) {
  if (!trackRent(account.type_id)) return null;
  let total = parseFloat(account.initial_inv || 0);
  state.records
    .filter(r => r.account_id === account.id && r.month <= upToMonth)
    .forEach(r => { total += parseFloat(r.top_up || 0); });
  return total;
}

// All months that have at least one record
function allMonths() {
  return [...new Set(state.records.map(r => r.month))].sort();
}

function totalForMonth(month) {
  return state.accounts.reduce((sum, acc) => sum + getValue(acc.id, month), 0);
}

// ── Load all data from Supabase ───────────────────────────

async function loadAllData() {
  const [types, accounts, records] = await Promise.all([
    dbGetTypes(),
    dbGetAccounts(),
    dbGetRecords(),
  ]);
  state.types    = types;
  state.accounts = accounts;
  state.records  = records;
}

// ── Export backup (JSON) ──────────────────────────────────

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'portfolio-backup-' + mesKey(new Date()) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── UI helpers ────────────────────────────────────────────

let _toastTimer = null;

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  const icon = type === 'success' ? 'ti-circle-check'
             : type === 'error'   ? 'ti-circle-x'
             :                      'ti-info-circle';
  el.innerHTML = `<i class="ti ${icon}"></i> ${msg}`;
  el.className = 'toast-' + type;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

function showAlert(page, msg, type) {
  // Kept for backward compat — routes to toast
  showToast(msg, type === 'success' ? 'success' : type === 'info' ? 'info' : 'error');
}

// ── Active accounts (não arquivadas) ──────────────────────

function activeAccounts() {
  return state.accounts.filter(a => !a.archived);
}

// ── Confirm modal (promise-based) ─────────────────────────

let _modalResolve = null;

function showConfirm(title, msg, confirmLabel = 'Confirmar') {
  return new Promise(resolve => {
    _modalResolve = resolve;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-msg').innerHTML = msg;
    document.getElementById('modal-confirm-btn').textContent = confirmLabel;
    document.getElementById('modal-overlay').classList.add('show');
  });
}

function closeModal(result) {
  document.getElementById('modal-overlay').classList.remove('show');
  if (_modalResolve) { _modalResolve(result); _modalResolve = null; }
}

// ── Button loading state ──────────────────────────────────

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="btn-spinner"></span> A processar...';
    btn.classList.add('btn-loading');
  } else {
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    btn.classList.remove('btn-loading');
  }
}

// ── Session expired handler ───────────────────────────────

function isAuthError(e) {
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('jwt') || msg.includes('token') || msg.includes('unauthorized') || e?.status === 401;
}

function handleDbError(e, fallbackMsg) {
  console.error(e);
  if (isAuthError(e)) {
    showToast('Sessão expirada. Faz login novamente.', 'info');
    if (typeof showScreen === 'function') showScreen('screen-login');
  } else {
    showToast(fallbackMsg + ': ' + e.message, 'error');
  }
}
