// ============================================================
// Dashboard render
// ============================================================

let evolutionPeriod = 'all'; // '12' | '36' | 'all'

function setEvolutionPeriod(period, btn) {
  evolutionPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderEvolution();
}

function renderDashboard() {
  if (!document.getElementById('dash-alert')) return; // DOM not ready

  const months  = allMonths();
  const lastMonth = months[months.length - 1];

  // ── Onboarding for first use ───────────────────────────
  const onboardingEl = document.getElementById('dash-onboarding');
  const contentEl    = document.getElementById('dash-content');
  const isEmpty = !state.accounts.length && !state.records.length;

  if (isEmpty) {
    onboardingEl.style.display = 'block';
    contentEl.style.display = 'none';
    onboardingEl.innerHTML = `<div class="onboarding">
      <h2>Bem-vindo ao Portfólio Global 👋</h2>
      <p>Três passos para começares a acompanhar o teu patrimônio:</p>
      <div class="onboarding-steps">
        <div class="onboarding-step"><span class="num">1</span> Confirma os <strong>Tipos</strong> de ativos (já vêm 8 pré-definidos)</div>
        <div class="onboarding-step"><span class="num">2</span> Adiciona as tuas <strong>Contas</strong> (banco, corretora, exchange...)</div>
        <div class="onboarding-step"><span class="num">3</span> Regista os valores no separador <strong>Registar</strong></div>
      </div>
    </div>`;
    const headerTotal = document.getElementById('header-total');
    if (headerTotal) headerTotal.textContent = '';
    return;
  }

  onboardingEl.style.display = 'none';
  contentEl.style.display = 'block';

  const lastTotal = lastMonth ? totalForMonth(lastMonth) : 0;

  // ── Alert: remind to register ──────────────────────────
  const today = new Date();
  let alertHtml = '';
  if (today.getDate() >= 8 && today.getDate() <= 12) {
    const thisMonth = mesKey(today);
    const hasRecord = state.records.some(r => r.month === thisMonth);
    if (!hasRecord)
      alertHtml = `<div class="alert alert-info"><i class="ti ti-bell"></i> É altura de registar os valores de ${mesDisplay(today)}!</div>`;
  }
  const da = document.getElementById('dash-alert');
  da.innerHTML = alertHtml;
  da.style.display = alertHtml ? 'block' : 'none';

  // ── Header total ───────────────────────────────────────
  const headerTotal = document.getElementById('header-total');
  if (headerTotal) headerTotal.textContent = lastTotal > 0 ? fmt(lastTotal) : '';

  // ── Totals by type and institution ─────────────────────
  const totByType = {}, invByType = {}, totByInst = {};
  if (lastMonth) {
    state.accounts.forEach(acc => {
      const v = getValue(acc.id, lastMonth);
      if (v === 0 && acc.archived) return; // skip archived with no value
      totByType[acc.type_id] = (totByType[acc.type_id] || 0) + v;
      totByInst[acc.institution] = (totByInst[acc.institution] || 0) + v;
      if (trackRent(acc.type_id)) {
        const inv = investedUpTo(acc, lastMonth);
        if (inv !== null) invByType[acc.type_id] = (invByType[acc.type_id] || 0) + inv;
      }
    });
  }

  // ── Donut charts with custom % legends ─────────────────
  const typeIds    = Object.keys(totByType).filter(id => totByType[id] > 0);
  const typeVals   = typeIds.map(id => totByType[id]);
  const typeColors = typeIds.map(id => getType(id).color);
  renderDonut('chart-tipo', typeIds.map(id => getType(id).label), typeVals, typeColors);
  renderDonutLegend('legend-tipo', typeIds.map(id => ({ label: getType(id).label, color: getType(id).color, value: totByType[id] })), lastTotal);

  const instKeys   = Object.keys(totByInst).filter(k => totByInst[k] > 0);
  const instColors = ['#378ADD','#639922','#BA7517','#D85A30','#7F77DD','#1D9E75','#D4537E','#888780'];
  renderDonut('chart-banco', instKeys, instKeys.map(k => totByInst[k]), instColors.slice(0, instKeys.length));
  renderDonutLegend('legend-banco', instKeys.map((k, i) => ({ label: k, color: instColors[i % instColors.length], value: totByInst[k] })), lastTotal);

  // ── Rentability section ────────────────────────────────
  const rentTypes = state.types.filter(t => trackRent(t.id) && totByType[t.id] !== undefined);
  if (!rentTypes.length) {
    document.getElementById('dash-rentab').innerHTML = '';
  } else {
    let totalV = 0, totalI = 0;
    rentTypes.forEach(t => { totalV += totByType[t.id] || 0; totalI += invByType[t.id] || 0; });
    const pctGlobal = totalI > 0 ? ((totalV - totalI) / totalI * 100) : null;

    let rh = '<div class="section-title" style="margin-top:1rem">rentabilidade</div><div class="card">';
    rentTypes.forEach(t => {
      const v = totByType[t.id] || 0, inv = invByType[t.id] || 0;
      const p = inv > 0 ? ((v - inv) / inv * 100) : null;
      rh += `<div class="rentab-row">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${t.color};display:inline-block"></span>
          ${t.label}
        </span>
        <span style="display:flex;gap:12px;align-items:center">
          <span style="font-size:12px;color:var(--text-secondary)">${fmt(inv)} investido</span>
          <span style="font-weight:500">${fmt(v)}</span>
          ${p !== null ? `<span class="rent-pill ${rentClass(p)}">${fmtPct(p)}</span>` : '<span class="rent-pill rent-neu">—</span>'}
        </span>
      </div>`;
    });
    if (pctGlobal !== null) {
      rh += `<div class="rentab-row rentab-section-total">
        <span style="font-weight:500">Total carteira</span>
        <span style="display:flex;gap:12px;align-items:center">
          <span style="font-size:12px;color:var(--text-secondary)">${fmt(totalI)} investido</span>
          <span style="font-weight:500">${fmt(totalV)}</span>
          <span class="rent-pill ${rentClass(pctGlobal)}">${fmtPct(pctGlobal)}</span>
        </span>
      </div>`;
    }
    rh += '</div>';
    document.getElementById('dash-rentab').innerHTML = rh;
  }

  // ── Dividends section ──────────────────────────────────
  const divAccounts = state.accounts.filter(acc => trackDiv(acc.type_id));
  const divEl = document.getElementById('dash-div');
  if (!divAccounts.length || !lastMonth) {
    divEl.innerHTML = '';
  } else {
    const divMonth = divAccounts.reduce((sum, acc) => sum + getDividends(acc.id, lastMonth), 0);
    const year     = lastMonth.split('-')[0];
    const divYear  = state.records
      .filter(r => r.month.startsWith(year) && divAccounts.some(a => a.id === r.account_id))
      .reduce((sum, r) => sum + parseFloat(r.dividends || 0), 0);

    let dvh = `<div class="section-title" style="margin-top:1rem">dividendos / juros</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div class="metric">
        <div class="metric-label">recebidos em ${mesDisplay(new Date(lastMonth + '-02'))}</div>
        <div class="metric-value">${fmt(divMonth)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">acumulado ${year}</div>
        <div class="metric-value">${fmt(divYear)}</div>
      </div>
    </div>`;

    if (divMonth > 0) {
      dvh += '<div class="card">';
      divAccounts.filter(acc => getDividends(acc.id, lastMonth) > 0).forEach(acc => {
        const t = getType(acc.type_id);
        dvh += `<div class="rentab-row">
          <span style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${t.color};display:inline-block"></span>
            ${acc.name} <span style="font-size:11px;color:var(--text-secondary)">(${acc.institution})</span>
          </span>
          <span style="font-weight:500;color:#9A6B00">+${fmt(getDividends(acc.id, lastMonth), acc.currency)}</span>
        </div>`;
      });
      dvh += '</div>';
    }
    divEl.innerHTML = dvh;
  }

  renderEvolution();
}

// ── Donut legend with percentages ─────────────────────────

function renderDonutLegend(elId, items, total) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items.length || total <= 0) { el.innerHTML = ''; return; }
  el.innerHTML = items
    .sort((a, b) => b.value - a.value)
    .map(item => `<div class="donut-legend-item">
      <span class="legend-dot" style="background:${item.color}"></span>
      ${item.label}
      <span class="pct">${(item.value / total * 100).toFixed(1)}%</span>
    </div>`)
    .join('');
}

// ── Evolution chart + history table ───────────────────────

function renderEvolution() {
  const legendEl    = document.getElementById('evolucao-legend');
  const historicoEl = document.getElementById('historico-tabela');
  if (!legendEl || !historicoEl) return;

  let months = allMonths();

  // Apply period filter
  if (evolutionPeriod !== 'all') {
    const n = parseInt(evolutionPeriod);
    months = months.slice(-n);
  }

  const typeIds = [...new Set(state.accounts.map(a => a.type_id))];

  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    return MESES[parseInt(mo) - 1].slice(0, 3) + ' ' + y.slice(2);
  });

  const datasets = typeIds.map(tid => ({
    label: getType(tid).label,
    data: months.map(m => state.accounts.filter(a => a.type_id === tid).reduce((s, a) => s + getValue(a.id, m), 0)),
    backgroundColor: getType(tid).color + '33',
    borderColor: getType(tid).color,
    borderWidth: 2, fill: true, tension: 0.4,
    pointRadius: 4, pointBackgroundColor: getType(tid).color
  }));
  datasets.push({
    label: 'Total',
    data: months.map(m => totalForMonth(m)),
    borderColor: '#7F77DD', borderWidth: 2, borderDash: [4, 4],
    fill: false, tension: 0.4, pointRadius: 3,
    pointBackgroundColor: '#7F77DD', backgroundColor: 'transparent'
  });

  legendEl.innerHTML = [
    ...typeIds.map(tid => `<span class="legend-item"><span class="legend-dot" style="background:${getType(tid).color}"></span>${getType(tid).label}</span>`),
    `<span class="legend-item"><span class="legend-dot" style="background:#7F77DD;border:1px dashed #7F77DD"></span>Total</span>`
  ].join('');

  renderLineChart('chart-evolucao', labels, datasets);

  // ── History table (with mobile scroll wrapper) ─────────
  if (!months.length) {
    historicoEl.innerHTML = '<div class="empty-state">Ainda sem registos para mostrar.</div>';
    return;
  }

  const divTypeIds = state.types.filter(t => trackDiv(t.id)).map(t => t.id);
  const hasDivData = state.records.some(r => parseFloat(r.dividends || 0) > 0);

  let th = `<div class="card"><div class="table-scroll"><table><thead><tr style="border-bottom:0.5px solid var(--border-light)">
    <th style="text-align:left;color:var(--text-secondary);font-weight:500">Mês</th>`;
  typeIds.forEach(tid => {
    th += `<th style="text-align:right;color:var(--text-secondary);font-weight:500">${getType(tid).label}</th>`;
  });
  th += `<th style="text-align:right;color:var(--text-secondary);font-weight:500">Total</th>`;
  th += `<th style="text-align:right;color:var(--text-secondary);font-weight:500">Δ</th>`;
  if (hasDivData) th += `<th style="text-align:right;color:#9A6B00;font-weight:500">Div./Juros</th>`;
  th += '</tr></thead><tbody>';

  // Detect missing months (gaps) — full month list from first to last
  const allRecorded = allMonths();
  const gaps = new Set();
  if (allRecorded.length >= 2) {
    const [fy, fm] = allRecorded[0].split('-').map(Number);
    const [ly, lm] = allRecorded[allRecorded.length - 1].split('-').map(Number);
    let d = new Date(fy, fm - 1, 1);
    const end = new Date(ly, lm - 1, 1);
    while (d <= end) {
      const k = mesKey(d);
      if (!allRecorded.includes(k)) gaps.add(k);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }

  [...months].reverse().forEach((m, i, arr) => {
    const total = totalForMonth(m);
    const prev  = arr[i + 1] ? totalForMonth(arr[i + 1]) : null;
    const delta = prev !== null ? total - prev : null;
    const deltaPct = prev !== null && prev > 0 ? (delta / prev * 100) : null;
    const [y, mo] = m.split('-');
    const divTotal = hasDivData
      ? state.records.filter(r => r.month === m && divTypeIds.includes(state.accounts.find(a => a.id === r.account_id)?.type_id))
          .reduce((s, r) => s + parseFloat(r.dividends || 0), 0)
      : 0;

    th += `<tr style="border-bottom:0.5px solid var(--border-light)">
      <td>${MESES[parseInt(mo) - 1]} ${y}</td>`;
    typeIds.forEach(tid => {
      const v = state.accounts.filter(a => a.type_id === tid).reduce((s, a) => s + getValue(a.id, m), 0);
      th += `<td style="text-align:right">${fmt(v)}</td>`;
    });
    th += `<td style="text-align:right;font-weight:500">${fmt(total)}</td>`;
    th += `<td style="text-align:right;font-size:12px;color:${delta === null ? 'var(--text-secondary)' : delta >= 0 ? 'var(--text-success)' : 'var(--text-danger)'}">
      ${delta === null ? '—' : (delta >= 0 ? '+' : '') + fmt(delta) + (deltaPct !== null ? ` (${fmtPct(deltaPct)})` : '')}
    </td>`;
    if (hasDivData) th += `<td style="text-align:right;color:${divTotal > 0 ? '#9A6B00' : 'var(--text-secondary)'}">
      ${divTotal > 0 ? '+' + fmt(divTotal) : '—'}
    </td>`;
    th += '</tr>';

    // Gap indicator row — between this month and the next older one
    const nextOlder = arr[i + 1];
    if (nextOlder) {
      const missingBetween = [...gaps].filter(g => g > nextOlder && g < m).sort().reverse();
      missingBetween.forEach(g => {
        const [gy, gm] = g.split('-');
        th += `<tr><td colspan="${typeIds.length + 3 + (hasDivData ? 1 : 0)}" style="text-align:center;font-size:12px;color:var(--text-danger);padding:4px;background:var(--bg-secondary)">
          <i class="ti ti-alert-triangle"></i> ${MESES[parseInt(gm) - 1]} ${gy} sem registo
        </td></tr>`;
      });
    }
  });

  th += '</tbody></table></div></div>';
  historicoEl.innerHTML = th;
}
