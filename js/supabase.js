// ============================================================
// Supabase client + all database queries
// ============================================================

const SUPABASE_URL = 'https://riibjrhagsjxviqxwqrb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaWJqcmhhZ3NqeHZpcXh3cXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxOTkyNzQsImV4cCI6MjA5Nzc3NTI3NH0.9hCqmSangBy3jZPEcFbppO8fxI4JZwotJePuhJWRfQ0';

let sb; // Supabase client, initialized in app.js

function initSupabase() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── Auth ──────────────────────────────────────────────────

async function sendMagicLink() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return;
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'A enviar...';
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  const msg = document.getElementById('login-msg');
  msg.style.display = 'block';
  if (error) {
    msg.style.background = '#fce8e8';
    msg.style.color = '#c0392b';
    msg.textContent = 'Erro: ' + error.message;
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send"></i> Enviar link de acesso';
  } else {
    msg.textContent = 'Link enviado! Verifica o teu email e clica no link para entrar.';
    btn.textContent = 'Email enviado ✓';
  }
}

async function signOut() {
  await sb.auth.signOut();
  location.reload();
}

async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ── Account Types ─────────────────────────────────────────

async function dbGetTypes() {
  const { data, error } = await sb
    .from('account_types')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

async function dbInsertType(type) {
  const { data, error } = await sb
    .from('account_types')
    .insert(type)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdateType(id, updates) {
  const { error } = await sb
    .from('account_types')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

async function dbDeleteType(id) {
  const { error } = await sb
    .from('account_types')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Accounts ──────────────────────────────────────────────

async function dbGetAccounts() {
  const { data, error } = await sb
    .from('accounts')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

async function dbInsertAccount(account) {
  const { data, error } = await sb
    .from('accounts')
    .insert(account)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteAccount(id) {
  const { error } = await sb
    .from('accounts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function dbUpdateAccount(id, updates) {
  const { error } = await sb
    .from('accounts')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// ── Monthly Records ───────────────────────────────────────

async function dbGetRecords() {
  const { data, error } = await sb
    .from('monthly_records')
    .select('*')
    .order('month');
  if (error) throw error;
  return data;
}

async function dbUpsertRecord(record) {
  const { error } = await sb
    .from('monthly_records')
    .upsert(record, { onConflict: 'account_id,month' });
  if (error) throw error;
}

async function dbUpsertRecords(records) {
  if (!records.length) return;
  const { error } = await sb
    .from('monthly_records')
    .upsert(records, { onConflict: 'account_id,month' });
  if (error) throw error;
}
