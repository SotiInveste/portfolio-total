// ============================================================
// Monthly record page
// ============================================================

function navMes(dir) {
  mesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + dir, 1);
  renderRegisto();
}

function onMesPicker(value) {
  if (!value) return;
  const [y, m] = value.split('-').map(Number);
  mesAtual = new Date(y, m - 1, 1);
  renderRegisto();
}

// ── Copiar valores do mês anterior ────────────────────────

function copyPreviousMonth() {
  const month = mesKey(mesAtual);
  const prevMonths = allMonths().filter(m => m < month);
  const prevMonth = prevMonths[prevMonths.length - 1];

  if (!prevMonth) {
    showToast('Não há nenhum mês anterior registado.', 'info');
    return;
  }

  let copied = 0;
  activeAccounts().forEach(acc => {
    const el = document.getElementById('inp-' + acc.id);
    if (!el) return;
    const prevValue = getValue(acc.id, prevMonth);
    if (prevValue > 0) {
      el.value = prevValue;
      copied++;
      // Recalcular pill/subtotal
      const instId = acc.institution.replace(/\W/g, '_');
      onRegistoInput(acc.id, instId);
    }
  });

  const [y, m] = prevMonth.split('-');
  showToast(`Copiados ${copied} valores de ${MESES[parseInt(m) - 1]} ${y}. Ajusta o que mudou e guarda.`, 'info');
}

// ── Render ────────────────────────────────────────────────

function renderRegisto() {
  const month = mesKey(mesAtual);

  const picker = document.getElementById('mes-picker');
  if (picker) picker.value = month;

  const hasRecord = state.records.some(r => r.month === month);
  const statusEl = document.getElementById('registo-status');
  if (statusEl) statusEl.textContent = hasRecord ? '✓ Guardado' : 'Sem registo';

  const container = document.getElementById('registo-contas');
  if (!container) return;

  const accounts = activeAccounts();
  if (!accounts.length) {
    container.innerHTML =
      '<div class="empty-state">Começa por adicionar contas no separador <strong>Contas</strong>.</div>';
    return;
  }

  const prevMonths = allMonths().filter(m => m < month);
  const prevMonth  = prevMonths[prevMonths.length - 1];

  const byInst = {};
  accounts.forEach(acc => {
    if (!byInst[acc.institution]) byInst[acc.institution] = [];
    byInst[acc.institution].push(acc);
  });

  let html = '';
  Object.entries(byInst).forEach(([inst, accs]) => {
    const sub    = accs.reduce((s, acc) => s + getValue(acc.id, month), 0);
    const instId = inst.replace(/\W/g, '_');
    const hasRentInGroup = accs.some(acc => trackRent(acc.type_id));
    const hasDivInGroup  = accs.some(acc => trackDiv(acc.type_id));

    html += `<div class="registo-card">
      <div class="registo-header">
        <span style="font-weight:500;font-size:14px">${inst}</span>
        <span class="registo-total" id="sub-${instId}">${fmt(sub)}</span>
      </div>`;

    if (hasRentInGroup || hasDivInGroup) {
      html += `<div style="display:grid;grid-template-columns:1fr 120px${hasRentInGroup ? ' 100px' : ''}${hasDivInGroup ? ' 100px' : ''}${hasRentInGroup ? ' auto' : ''};gap:8px;padding-bottom:6px;border-bottom:0.5px solid var(--border-light);margin-bottom:4px">
        <span></span>
        <span class="col-header">Valor atual</span>
        ${hasRentInGroup ? '<span class="col-header">Reforço</span>' : ''}
        ${hasDivInGroup  ? '<span class="col-header-div">Div./Juros</span>' : ''}
        ${hasRentInGroup ? '<span></span>' : ''}
      </div>`;
    }

    accs.forEach(acc => {
      const rec     = getRecord(acc.id, month);
      const val     = rec ? rec.value || '' : '';
      const topup   = rec ? rec.top_up || '' : '';
      const divs    = rec ? rec.dividends || '' : '';
      const hasRent = trackRent(acc.type_id);
      const hasDiv  = trackDiv(acc.type_id);
      const t       = getType(acc.type_id);

      let invBase = parseFloat(acc.initial_inv || 0);
      if (prevMonth) {
        state.records
          .filter(r => r.account_id === acc.id && r.month <= prevMonth)
          .forEach(r => { invBase += parseFloat(r.top_up || 0); });
      }
      const invWithTopup = invBase + parseFloat(topup || 0);
      const pct = hasRent && val && invWithTopup > 0
        ? ((parseFloat(val) - invWithTopup) / invWithTopup * 100)
        : null;

      if (hasRent || hasDiv) {
        const cols = `1fr 120px${hasRent ? ' 100px' : ''}${hasDiv ? ' 100px' : ''}${hasRent ? ' auto' : ''}`;
        html += `<div class="registo-row" style="display:grid;grid-template-columns:${cols};gap:8px;align-items:center">
          <span class="registo-name" style="display:flex;align-items:center;gap:6px">
            <span class="account-dot" style="background:${t.color}"></span>
            ${acc.name}
          </span>
          <input class="registo-input" type="number" step="0.01" min="0" placeholder="0,00"
            value="${val}" id="inp-${acc.id}" oninput="onRegistoInput('${acc.id}','${instId}')">
          ${hasRent ? `<input class="registo-secondary" type="number" step="0.01" min="0" placeholder="opcional"
            value="${topup}" id="topup-${acc.id}" oninput="onRegistoInput('${acc.id}','${instId}')">` : ''}
          ${hasDiv  ? `<input class="registo-div-input" type="number" step="0.01" min="0" placeholder="opcional"
            value="${divs}" id="div-${acc.id}">` : ''}
          ${hasRent ? `<span class="registo-rent-pill ${pct !== null ? rentClass(pct) : 'rent-neu'}" id="pill-${acc.id}">
            ${pct !== null ? fmtPct(pct) : '—'}
          </span>` : ''}
        </div>`;
      } else {
        html += `<div class="registo-row" style="display:flex;align-items:center;gap:8px">
          <span class="account-dot" style="background:${t.color}"></span>
          <span class="registo-name" style="flex:1">${acc.name}
            <span class="type-badge" style="${badgeStyle(acc.type_id)}">${t.label}</span>
          </span>
          <input class="registo-input" type="number" step="0.01" min="0" placeholder="0,00"
            value="${val}" id="inp-${acc.id}" oninput="onRegistoInput('${acc.id}','${instId}')">
        </div>`;
      }
    });
    html += '</div>';
  });

  container.innerHTML = html;
}

function onRegistoInput(accountId, instId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;
  const month = mesKey(mesAtual);

  if (trackRent(acc.type_id)) {
    const v      = parseFloat(document.getElementById('inp-' + accountId)?.value || 0);
    const topup  = parseFloat(document.getElementById('topup-' + accountId)?.value || 0);
    const prevMonths = allMonths().filter(m => m < month);
    const prevMonth  = prevMonths[prevMonths.length - 1];

    let invBase = parseFloat(acc.initial_inv || 0);
    if (prevMonth) {
      state.records
        .filter(r => r.account_id === accountId && r.month <= prevMonth)
        .forEach(r => { invBase += parseFloat(r.top_up || 0); });
    }
    const invTotal = invBase + topup;
    const pill = document.getElementById('pill-' + accountId);
    if (pill) {
      if (invTotal > 0) {
        const p = (v - invTotal) / invTotal * 100;
        pill.textContent = fmtPct(p);
        pill.className = 'registo-rent-pill ' + rentClass(p);
      } else {
        pill.textContent = '—';
        pill.className = 'registo-rent-pill rent-neu';
      }
    }
  }

  const instAccs = activeAccounts().filter(a => a.institution.replace(/\W/g, '_') === instId);
  const sub = instAccs.reduce((s, a) => s + parseFloat(document.getElementById('inp-' + a.id)?.value || 0), 0);
  const subEl = document.getElementById('sub-' + instId);
  if (subEl) subEl.textContent = fmt(sub);
}

// ── Save (updates local state, no full refetch) ───────────

async function saveMonthlyRecord() {
  const month = mesKey(mesAtual);
  const btn = document.querySelector('.save-btn-wrap .btn-primary');
  const records = [];

  activeAccounts().forEach(acc => {
    const vEl = document.getElementById('inp-' + acc.id);
    if (!vEl) return;
    records.push({
      account_id: acc.id,
      month,
      value:      parseFloat(vEl.value || 0),
      top_up:     parseFloat(document.getElementById('topup-' + acc.id)?.value || 0),
      dividends:  parseFloat(document.getElementById('div-' + acc.id)?.value || 0),
    });
  });

  setBtnLoading(btn, true);
  try {
    await dbUpsertRecords(records);

    // Update local state directly — no refetch
    records.forEach(rec => {
      const idx = state.records.findIndex(r => r.account_id === rec.account_id && r.month === rec.month);
      if (idx >= 0) {
        state.records[idx] = { ...state.records[idx], ...rec };
      } else {
        state.records.push(rec);
      }
    });

    document.getElementById('registo-status').textContent = '✓ Guardado';
    showToast('Registo guardado com sucesso');
  } catch (e) {
    handleDbError(e, 'Erro ao guardar');
  } finally {
    setBtnLoading(btn, false);
  }
}
