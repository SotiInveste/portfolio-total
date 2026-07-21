// ============================================================
// Accounts page
// ============================================================

function populateTypeSelect() {
  const sel = document.getElementById('nova-tipo');
  const cur = sel.value;
  sel.innerHTML = state.types.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  if (cur && state.types.find(t => t.id === cur)) sel.value = cur;
  toggleInvInicialField();
}

function toggleInvInicialField() {
  const typeId = document.getElementById('nova-tipo').value;
  const wrap = document.getElementById('inv-inicial-wrap');
  wrap.style.display = trackRent(typeId) ? 'flex' : 'none';
  wrap.style.flexDirection = 'column';
}

async function addAccount() {
  const name      = document.getElementById('nova-nome').value.trim();
  const inst      = document.getElementById('nova-banco').value.trim();
  const typeId    = document.getElementById('nova-tipo').value;
  const currency  = document.getElementById('nova-moeda').value;
  const btn       = document.querySelector('#page-contas .form-actions .btn-primary');

  if (!name || !inst) {
    showToast('Preenche o nome e o banco / entidade.', 'info');
    return;
  }

  const account = {
    id:          'acc_' + Date.now(),
    name,
    institution: inst,
    type_id:     typeId,
    currency,
    sort_order:  state.accounts.length,
    archived:    false,
  };

  if (trackRent(typeId)) {
    const inv = parseFloat(document.getElementById('nova-inv-inicial').value || 0);
    if (inv > 0) account.initial_inv = inv;
  }

  setBtnLoading(btn, true);
  try {
    const created = await dbInsertAccount(account);
    state.accounts.push(created);
    document.getElementById('nova-nome').value = '';
    document.getElementById('nova-banco').value = '';
    document.getElementById('nova-inv-inicial').value = '';
    showToast('Conta adicionada com sucesso.');
    renderContas();
  } catch (e) {
    handleDbError(e, 'Erro ao adicionar conta');
  } finally {
    setBtnLoading(btn, false);
  }
}

// ── Archive / Unarchive (soft delete) ─────────────────────

async function archiveAccount(id) {
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;

  const ok = await showConfirm(
    'Arquivar conta',
    `A conta <strong>${acc.name}</strong> (${acc.institution}) vai deixar de aparecer no registo mensal, mas todo o histórico é preservado nos gráficos e tabelas.<br><br>Podes desarquivá-la a qualquer momento.`,
    'Arquivar'
  );
  if (!ok) return;

  try {
    await dbUpdateAccount(id, { archived: true });
    acc.archived = true;
    showToast('Conta arquivada. O histórico foi preservado.');
    renderContas();
  } catch (e) {
    handleDbError(e, 'Erro ao arquivar');
  }
}

async function unarchiveAccount(id) {
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;
  try {
    await dbUpdateAccount(id, { archived: false });
    acc.archived = false;
    showToast('Conta reativada.');
    renderContas();
  } catch (e) {
    handleDbError(e, 'Erro ao reativar');
  }
}

// ── Reorder ───────────────────────────────────────────────

async function moveAccount(id, dir) {
  const active = activeAccounts();
  const idx = active.findIndex(a => a.id === id);
  const swapIdx = idx + dir;
  if (idx < 0 || swapIdx < 0 || swapIdx >= active.length) return;

  const a = active[idx], b = active[swapIdx];
  const tmpOrder = a.sort_order;
  a.sort_order = b.sort_order;
  b.sort_order = tmpOrder;

  // Sort state.accounts to reflect new order
  state.accounts.sort((x, y) => (x.sort_order || 0) - (y.sort_order || 0));
  renderContas();

  try {
    await Promise.all([
      dbUpdateAccount(a.id, { sort_order: a.sort_order }),
      dbUpdateAccount(b.id, { sort_order: b.sort_order }),
    ]);
  } catch (e) {
    handleDbError(e, 'Erro ao reordenar');
  }
}

// ── Render ────────────────────────────────────────────────

function renderContas() {
  const listEl = document.getElementById('lista-contas');
  if (!listEl) return;

  if (!state.accounts.length) {
    listEl.innerHTML = '<div class="empty-state">Ainda sem contas adicionadas.</div>';
    return;
  }

  const months  = allMonths();
  const lastMonth = months[months.length - 1];
  const active   = activeAccounts();
  const archived = state.accounts.filter(a => a.archived);

  let html = '';

  // ── Active accounts grouped by institution ──
  const byInst = {};
  active.forEach(acc => {
    if (!byInst[acc.institution]) byInst[acc.institution] = [];
    byInst[acc.institution].push(acc);
  });

  Object.entries(byInst).forEach(([inst, accs]) => {
    html += `<div class="card"><div style="font-weight:500;font-size:14px;margin-bottom:8px">${inst}</div>`;
    accs.forEach(acc => {
      const t   = getType(acc.type_id);
      const v   = lastMonth ? getValue(acc.id, lastMonth) : null;
      const inv = trackRent(acc.type_id) && lastMonth ? investedUpTo(acc, lastMonth) : null;
      const pct = inv && inv > 0 ? ((v - inv) / inv * 100) : null;
      const globalIdx = active.findIndex(a => a.id === acc.id);

      html += `<div class="account-row">
        <div class="reorder-btns">
          <button onclick="moveAccount('${acc.id}', -1)" ${globalIdx === 0 ? 'disabled' : ''} aria-label="Mover para cima"><i class="ti ti-chevron-up"></i></button>
          <button onclick="moveAccount('${acc.id}', 1)" ${globalIdx === active.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo"><i class="ti ti-chevron-down"></i></button>
        </div>
        <span class="account-dot" style="background:${t.color}"></span>
        <div class="account-name">
          ${acc.name}
          <div class="account-institution">${acc.currency}${acc.initial_inv > 0 ? ` · inv. inicial: ${fmt(acc.initial_inv, acc.currency)}` : ''}</div>
        </div>
        <span class="type-badge" style="${badgeStyle(acc.type_id)}">${t.label}</span>
        ${pct !== null ? `<span class="rent-pill ${rentClass(pct)}">${fmtPct(pct)}</span>` : ''}
        ${v !== null && v > 0 ? `<div class="account-val">${fmt(v, acc.currency)}</div>` : ''}
        <button class="remove-btn" onclick="archiveAccount('${acc.id}')" aria-label="Arquivar ${acc.name}" title="Arquivar">
          <i class="ti ti-archive"></i>
        </button>
      </div>`;
    });
    html += '</div>';
  });

  // ── Archived accounts ──
  if (archived.length) {
    html += `<div class="section-title archived-title">arquivadas</div><div class="card">`;
    archived.forEach(acc => {
      const t = getType(acc.type_id);
      html += `<div class="account-row archived">
        <span class="account-dot" style="background:${t.color}"></span>
        <div class="account-name">${acc.name}
          <div class="account-institution">${acc.institution}</div>
        </div>
        <span class="type-badge" style="${badgeStyle(acc.type_id)}">${t.label}</span>
        <button class="btn-ghost btn-sm" onclick="unarchiveAccount('${acc.id}')">
          <i class="ti ti-archive-off"></i> Reativar
        </button>
      </div>`;
    });
    html += '</div>';
  }

  listEl.innerHTML = html;
}
