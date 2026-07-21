// ============================================================
// Chart management
// ============================================================

const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function renderDonut(canvasId, labels, values, colors) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !values.length) return;
  _charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.raw) } }
      }
    }
  });
}

function renderLineChart(canvasId, labels, datasets) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.style.display = 'block';
  const wrap = canvas.parentElement;
  const overlay = wrap?.querySelector('.no-data-overlay');
  if (overlay) overlay.remove();

  if (!labels.length) {
    canvas.style.display = 'none';
    if (wrap) {
      const ndo = document.createElement('div');
      ndo.className = 'no-data-overlay';
      ndo.textContent = 'Ainda sem dados suficientes para o gráfico.';
      wrap.appendChild(ndo);
    }
    return;
  }

  _charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(128,128,128,.1)' }, ticks: { font: { size: 11 }, autoSkip: false, maxRotation: 45 } },
        y: { grid: { color: 'rgba(128,128,128,.1)' }, ticks: { callback: v => v.toLocaleString('pt-PT') + '€', font: { size: 11 } } }
      }
    }
  });
}
