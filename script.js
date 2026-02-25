/* ============================================================
   SISTEMA ETI – LÓGICA PRINCIPAL
   Autor: Joel A. Timoteo Gonza – Relaciones Laborales
   ============================================================ */

'use strict';

// ─── CONSTANTES ───────────────────────────────────────────────
const STORAGE_KEY = 'eti_registros_v2';

// Días festivos nacionales Perú (MM-DD) – ampliar según necesidad
const FESTIVOS_PERU = [
  '01-01','04-17','04-18','05-01','06-29','07-28','07-29',
  '08-30','10-08','11-01','12-08','12-09','12-25'
];

// ─── ESTADO GLOBAL ────────────────────────────────────────────
let registros = [];
let charts = {};
let editingId = null;

// ─── INICIALIZACIÓN ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarRegistros();
  actualizarHeaderFecha();
  initTabs();
  initForm();
  initBuscador();
  initModal();
  initBotones();
  renderAll();
});

// ─── TABS ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
      if (target === 'dashboard') renderDashboard();
      if (target === 'tabla') renderTabla();
      if (target === 'ranking') renderRanking();
    });
  });
}

// ─── TEMPORADA ────────────────────────────────────────────────
function detectarTemporada(fecha) {
  // fecha: objeto Date o string YYYY-MM-DD
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : new Date(fecha);
  const mes = d.getMonth() + 1; // 1-12
  const dia = d.getDate();
  const val = mes * 100 + dia;
  // Baja: 05 Ene (0105) – 26 Jun (0626)
  // Alta: 27 Jun (0627) – 31 Dic (1231)
  if (val >= 105 && val <= 626) return 'baja';
  return 'alta';
}

function esFestivo(fecha) {
  const d = new Date(fecha.getTime());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return FESTIVOS_PERU.includes(mm + '-' + dd);
}

function esDiaHabil(fecha, temporada) {
  const dow = fecha.getDay(); // 0=Dom,6=Sab
  if (dow === 0) return false; // Domingo nunca
  if (temporada === 'baja' && dow === 6) return false; // Sábado solo en alta
  if (esFestivo(fecha)) return false;
  return true;
}

function calcularFechaLimite(fechaEjecStr) {
  const temporada = detectarTemporada(fechaEjecStr);
  let d = new Date(fechaEjecStr + 'T12:00:00');
  let habiles = 0;
  while (habiles < 3) {
    d.setDate(d.getDate() + 1);
    if (esDiaHabil(d, temporada)) habiles++;
  }
  return {
    fechaLimite: formatDate(d),
    temporada
  };
}

// ─── ESTADO DEL REGISTRO ──────────────────────────────────────
function calcularEstado(reg) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fEjec  = new Date(reg.fechaEjecucion + 'T12:00:00');
  const fLimite = new Date(reg.fechaLimite + 'T12:00:00');
  const fEnvio  = reg.fechaEnvio ? new Date(reg.fechaEnvio + 'T12:00:00') : null;

  // Si hay fecha de envío → comparar con límite
  if (fEnvio) {
    const diffMs = fEnvio - fLimite;
    const diffDias = Math.round(diffMs / 86400000);
    if (diffDias <= 0) {
      return { estado: 'cumplido', avance: 100, retraso: 0, diasRetraso: 0 };
    } else {
      const pctRetraso = Math.min(Math.round((diffDias / 3) * 100), 100);
      return { estado: 'critico', avance: 100, retraso: pctRetraso, diasRetraso: diffDias };
    }
  }

  // Sin fecha de envío → calcular con fecha actual
  if (hoy <= fLimite) {
    // En plazo → calcular avance
    const diasUsados = Math.max(0, Math.round((hoy - fEjec) / 86400000));
    const avance = Math.min(Math.round((diasUsados / 3) * 100), 100);
    return { estado: 'proceso', avance, retraso: 0, diasRetraso: 0 };
  } else {
    // Retraso
    const diasRet = Math.round((hoy - fLimite) / 86400000);
    const pctRetraso = Math.min(Math.round((diasRet / 3) * 100), 100);
    const nivel = diasRet <= 2 ? 'leve' : 'critico';
    return { estado: nivel, avance: 100, retraso: pctRetraso, diasRetraso: diasRet };
  }
}

// ─── HEADER FECHA Y TEMPORADA ─────────────────────────────────
function actualizarHeaderFecha() {
  const hoy = new Date();
  const temporada = detectarTemporada(hoy);
  const badge = document.getElementById('seasonBadge');
  badge.textContent = temporada === 'alta' ? '🌡 Temporada Alta' : '❄ Temporada Baja';
  badge.className = 'season-badge ' + temporada;

  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  document.getElementById('currentDate').textContent =
    `${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

// ─── FORMULARIO REGISTRO ──────────────────────────────────────
function initForm() {
  const form = document.getElementById('etiForm');
  const btnPreview = document.getElementById('btnPreview');

  btnPreview.addEventListener('click', mostrarPreview);
  form.addEventListener('submit', e => {
    e.preventDefault();
    guardarRegistro();
  });
}

function mostrarPreview() {
  const fechaE = document.getElementById('fFechaEjecucion').value;
  if (!fechaE) { showToast('Ingresa la fecha de ejecución primero.', true); return; }
  const { fechaLimite, temporada } = calcularFechaLimite(fechaE);
  const previewBox = document.getElementById('previewBox');
  const grid = document.getElementById('previewGrid');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fLim = new Date(fechaLimite + 'T12:00:00');
  const restante = Math.round((fLim - hoy) / 86400000);
  const estado = restante >= 0 ? 'En plazo' : `Vencido (${Math.abs(restante)} días)`;

  grid.innerHTML = `
    <div class="preview-item"><div class="p-label">Temporada</div><div class="p-value">${temporada === 'alta' ? '🌡 Alta' : '❄ Baja'}</div></div>
    <div class="preview-item"><div class="p-label">Días hábiles contados</div><div class="p-value">Lunes–${temporada === 'alta' ? 'Sábado' : 'Viernes'}</div></div>
    <div class="preview-item highlight"><div class="p-label">Fecha Límite</div><div class="p-value">${formatDateDisplay(fechaLimite)}</div></div>
    <div class="preview-item"><div class="p-label">Estado actual</div><div class="p-value">${estado}</div></div>
  `;
  previewBox.style.display = 'block';
}

function guardarRegistro() {
  const supervisor  = document.getElementById('fSupervisor').value.trim();
  const sector      = document.getElementById('fSector').value.trim();
  const trabajadores= document.getElementById('fTrabajadores').value;
  const tema        = document.getElementById('fTema').value.trim();
  const fechaEjec   = document.getElementById('fFechaEjecucion').value;
  const fechaEnvio  = document.getElementById('fFechaEnvio').value;
  const obs         = document.getElementById('fObservaciones').value.trim();

  if (!supervisor || !sector || !trabajadores || !tema || !fechaEjec) {
    showToast('Por favor completa todos los campos obligatorios (*).', true);
    return;
  }

  const { fechaLimite, temporada } = calcularFechaLimite(fechaEjec);

  const reg = {
    id: Date.now().toString(),
    supervisor, sector, trabajadores: Number(trabajadores),
    tema, fechaEjecucion: fechaEjec,
    fechaLimite, fechaEnvio: fechaEnvio || null,
    temporada, observaciones: obs,
    creadoEn: new Date().toISOString()
  };

  registros.push(reg);
  guardarStorage();
  renderAll();
  document.getElementById('etiForm').reset();
  document.getElementById('previewBox').style.display = 'none';
  showToast('✅ Registro guardado correctamente.');

  // Cambiar a tabla
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="tabla"]').classList.add('active');
  document.getElementById('tab-tabla').classList.add('active');
  renderTabla();
}

// ─── TABLA PRINCIPAL ──────────────────────────────────────────
let filtroTexto = '';

function initBuscador() {
  document.getElementById('searchInput').addEventListener('input', e => {
    filtroTexto = e.target.value.toLowerCase();
    renderTabla();
  });
}

function renderTabla() {
  const tbody = document.getElementById('mainTableBody');
  const filtrados = registros.filter(r =>
    r.supervisor.toLowerCase().includes(filtroTexto) ||
    r.sector.toLowerCase().includes(filtroTexto) ||
    r.tema.toLowerCase().includes(filtroTexto)
  );

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="no-records">No hay registros que mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map((r, i) => {
    const est = calcularEstado(r);
    const badgeClass = {
      cumplido: 'badge-cumplido', proceso: 'badge-proceso',
      leve: 'badge-leve', critico: 'badge-critico'
    }[est.estado] || 'badge-proceso';
    const estadoLabel = {
      cumplido: '✔ Cumplido', proceso: '⏳ En proceso',
      leve: '⚠ Retraso leve', critico: '🔴 Retraso crítico'
    }[est.estado] || est.estado;

    const avancePct = est.avance;
    const retrasoPct = est.retraso;
    const colorAvance = avancePct === 100 ? 'fill-green' : 'fill-green';
    const colorRetraso = retrasoPct > 50 ? 'fill-red' : 'fill-orange';

    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(r.supervisor)}</strong></td>
      <td>${esc(r.sector)}</td>
      <td class="text-right">${r.trabajadores}</td>
      <td>${esc(r.tema)}</td>
      <td>${formatDateDisplay(r.fechaEjecucion)}</td>
      <td>${formatDateDisplay(r.fechaLimite)}</td>
      <td>${r.fechaEnvio ? formatDateDisplay(r.fechaEnvio) : '<span class="cell-muted">–</span>'}</td>
      <td><span class="badge ${r.temporada === 'alta' ? 'badge-alta' : 'badge-baja'}">${r.temporada === 'alta' ? '🌡 Alta' : '❄ Baja'}</span></td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill ${colorAvance}" style="width:${avancePct}%"></div></div>
          <span class="progress-pct" style="color:var(--green-bright)">${avancePct}%</span>
        </div>
      </td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill ${colorRetraso}" style="width:${retrasoPct}%"></div></div>
          <span class="progress-pct" style="color:${retrasoPct > 0 ? 'var(--red)' : 'var(--text-muted)'}">${retrasoPct}%</span>
        </div>
      </td>
      <td><span class="badge ${badgeClass}">${estadoLabel}</span></td>
      <td>
        <button class="btn btn-icon" title="Editar" onclick="abrirModal('${r.id}')">✏️</button>
        <button class="btn btn-icon" title="Eliminar" onclick="eliminarRegistro('${r.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  // Recalcular todos
  const totales = { total: registros.length, cumplido: 0, proceso: 0, retraso: 0 };
  const alertas = [];

  registros.forEach(r => {
    const est = calcularEstado(r);
    if (est.estado === 'cumplido') totales.cumplido++;
    else if (est.estado === 'proceso') totales.proceso++;
    else { totales.retraso++; }

    if (est.estado === 'critico') {
      alertas.push({ tipo: 'critico', texto: `${r.supervisor} – <em>${r.sector}</em> lleva ${est.diasRetraso} día(s) de retraso crítico.`, extra: `Capacitación: ${r.tema}` });
    } else if (est.estado === 'leve') {
      alertas.push({ tipo: 'leve', texto: `${r.supervisor} – <em>${r.sector}</em> presenta retraso leve (${est.diasRetraso} día/s).`, extra: `Capacitación: ${r.tema}` });
    } else if (est.estado === 'proceso') {
      const fLim = new Date(r.fechaLimite + 'T12:00:00');
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const restante = Math.round((fLim - hoy) / 86400000);
      if (restante <= 1) {
        alertas.push({ tipo: 'proceso', texto: `${r.supervisor} vence ${restante === 0 ? 'HOY' : 'MAÑANA'} – <em>${r.sector}</em>.`, extra: `Capacitación: ${r.tema}` });
      }
    }
  });

  // KPIs
  document.getElementById('kpiTotal').textContent = totales.total;
  document.getElementById('kpiCumplido').textContent = totales.cumplido;
  document.getElementById('kpiProceso').textContent = totales.proceso;
  document.getElementById('kpiRetraso').textContent = totales.retraso;
  const pct = totales.total > 0 ? Math.round((totales.cumplido / totales.total) * 100) : 0;
  document.getElementById('kpiPct').textContent = pct + '%';

  // Alertas
  const alertsList = document.getElementById('alertsList');
  if (alertas.length === 0) {
    alertsList.innerHTML = '<p class="empty-msg">✅ Sin alertas activas. Todo en orden.</p>';
  } else {
    const icons = { critico: '🔴', leve: '⚠️', proceso: '⏰' };
    alertsList.innerHTML = alertas.map(a => `
      <div class="alert-item alert-${a.tipo}">
        <span class="alert-icon">${icons[a.tipo]}</span>
        <div class="alert-text"><strong>${a.texto}</strong><span>${a.extra}</span></div>
      </div>
    `).join('');
  }

  // Gráficos
  renderCharts(totales, alertas);
}

function renderCharts(totales) {
  const estado_data = [totales.cumplido, totales.proceso,
    registros.filter(r => calcularEstado(r).estado === 'leve').length,
    registros.filter(r => calcularEstado(r).estado === 'critico').length
  ];

  // Chart 1: Estado
  destroyChart('chartEstado');
  charts.estado = new Chart(document.getElementById('chartEstado'), {
    type: 'doughnut',
    data: {
      labels: ['Cumplido','En Proceso','Retraso Leve','Retraso Crítico'],
      datasets: [{ data: estado_data, backgroundColor: ['#2ea86a','#3a7bd5','#e07a2a','#e05252'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 } } } }, cutout: '65%' }
  });

  // Chart 2: Por supervisor
  const supMap = {};
  registros.forEach(r => {
    if (!supMap[r.supervisor]) supMap[r.supervisor] = { cumplido: 0, total: 0 };
    supMap[r.supervisor].total++;
    if (calcularEstado(r).estado === 'cumplido') supMap[r.supervisor].cumplido++;
  });
  const supLabels = Object.keys(supMap);
  const supPct = supLabels.map(s => Math.round((supMap[s].cumplido / supMap[s].total) * 100));

  destroyChart('chartSupervisor');
  charts.supervisor = new Chart(document.getElementById('chartSupervisor'), {
    type: 'bar',
    data: {
      labels: supLabels.map(s => s.split(' ')[0]),
      datasets: [{ label: '% Cumplimiento', data: supPct, backgroundColor: '#1a6645', borderRadius: 6 }]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { max: 100, ticks: { callback: v => v + '%' } } }
    }
  });

  // Chart 3: Por mes
  const mesMap = {};
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  registros.forEach(r => {
    const m = new Date(r.fechaEjecucion + 'T12:00:00').getMonth();
    mesMap[m] = (mesMap[m] || 0) + 1;
  });
  const mesLabels = Object.keys(mesMap).sort((a,b)=>a-b).map(k => meses[k]);
  const mesCounts = Object.keys(mesMap).sort((a,b)=>a-b).map(k => mesMap[k]);

  destroyChart('chartMes');
  charts.mes = new Chart(document.getElementById('chartMes'), {
    type: 'line',
    data: {
      labels: mesLabels,
      datasets: [{ label: 'Registros', data: mesCounts, borderColor: '#2ea86a', backgroundColor: 'rgba(46,168,106,.1)', tension: .4, fill: true, pointRadius: 5 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Chart 4: Temporada
  const alta = registros.filter(r => r.temporada === 'alta').length;
  const baja = registros.length - alta;
  destroyChart('chartTemporada');
  charts.temporada = new Chart(document.getElementById('chartTemporada'), {
    type: 'pie',
    data: {
      labels: ['Temporada Alta','Temporada Baja'],
      datasets: [{ data: [alta, baja], backgroundColor: ['#e8b94a','#3a7bd5'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 } } } } }
  });
}

function destroyChart(id) {
  if (charts[id.replace('chart','').toLowerCase()]) {
    charts[id.replace('chart','').toLowerCase()].destroy();
  }
  const existing = Chart.getChart(document.getElementById(id));
  if (existing) existing.destroy();
}

// ─── RANKING ──────────────────────────────────────────────────
function renderRanking() {
  const container = document.getElementById('rankingContainer');
  if (registros.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay registros para generar ranking.</p>';
    return;
  }

  const supMap = {};
  registros.forEach(r => {
    if (!supMap[r.supervisor]) supMap[r.supervisor] = { cumplido: 0, proceso: 0, retraso: 0, total: 0, sector: r.sector };
    supMap[r.supervisor].total++;
    const est = calcularEstado(r).estado;
    if (est === 'cumplido') supMap[r.supervisor].cumplido++;
    else if (est === 'proceso') supMap[r.supervisor].proceso++;
    else supMap[r.supervisor].retraso++;
  });

  const ranking = Object.entries(supMap)
    .map(([nombre, d]) => ({ nombre, ...d, pct: Math.round((d.cumplido / d.total) * 100) }))
    .sort((a, b) => b.pct - a.pct || a.retraso - b.retraso);

  const medalColor = ['gold', 'silver', 'bronze'];
  container.innerHTML = ranking.map((r, i) => `
    <div class="ranking-card ${i < 3 ? 'rank' + (i+1) : ''}">
      <div class="ranking-pos ${medalColor[i] || ''}">${i < 3 ? ['🥇','🥈','🥉'][i] : '#' + (i + 1)}</div>
      <div class="ranking-info">
        <h4>${esc(r.nombre)}</h4>
        <p>${esc(r.sector)} · ${r.total} registro(s) · ${r.cumplido} cumplidos · ${r.retraso} retrasos</p>
      </div>
      <div class="ranking-pct">${r.pct}%</div>
    </div>
  `).join('');
}

// ─── MODAL EDITAR ─────────────────────────────────────────────
function initModal() {
  document.getElementById('modalClose').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelEdit').addEventListener('click', cerrarModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) cerrarModal();
  });
  document.getElementById('editForm').addEventListener('submit', e => {
    e.preventDefault();
    guardarEdicion();
  });
}

function abrirModal(id) {
  const reg = registros.find(r => r.id === id);
  if (!reg) return;
  editingId = id;
  document.getElementById('editId').value = id;
  document.getElementById('eSupervisor').value = reg.supervisor;
  document.getElementById('eSector').value = reg.sector;
  document.getElementById('eTrabajadores').value = reg.trabajadores;
  document.getElementById('eTema').value = reg.tema;
  document.getElementById('eFechaEjecucion').value = reg.fechaEjecucion;
  document.getElementById('eFechaEnvio').value = reg.fechaEnvio || '';
  document.getElementById('eObservaciones').value = reg.observaciones || '';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  editingId = null;
}

function guardarEdicion() {
  const id = document.getElementById('editId').value;
  const idx = registros.findIndex(r => r.id === id);
  if (idx === -1) return;

  const fechaEjec = document.getElementById('eFechaEjecucion').value;
  const { fechaLimite, temporada } = calcularFechaLimite(fechaEjec);

  registros[idx] = {
    ...registros[idx],
    supervisor:    document.getElementById('eSupervisor').value.trim(),
    sector:        document.getElementById('eSector').value.trim(),
    trabajadores:  Number(document.getElementById('eTrabajadores').value),
    tema:          document.getElementById('eTema').value.trim(),
    fechaEjecucion: fechaEjec,
    fechaLimite, temporada,
    fechaEnvio:    document.getElementById('eFechaEnvio').value || null,
    observaciones: document.getElementById('eObservaciones').value.trim()
  };

  guardarStorage();
  renderAll();
  cerrarModal();
  showToast('✏️ Registro actualizado.');
}

// ─── ELIMINAR ─────────────────────────────────────────────────
function eliminarRegistro(id) {
  if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
  registros = registros.filter(r => r.id !== id);
  guardarStorage();
  renderAll();
  showToast('🗑 Registro eliminado.');
}

// ─── EXPORTAR EXCEL ───────────────────────────────────────────
function exportarExcel() {
  if (registros.length === 0) { showToast('No hay registros para exportar.', true); return; }

  const data = registros.map((r, i) => {
    const est = calcularEstado(r);
    const estadoLabel = { cumplido:'Cumplido', proceso:'En Proceso', leve:'Retraso Leve', critico:'Retraso Crítico' }[est.estado] || est.estado;
    return {
      '#': i + 1,
      'Supervisor': r.supervisor,
      'Sector': r.sector,
      'Trabajadores': r.trabajadores,
      'Tema': r.tema,
      'Fecha Ejecución': formatDateDisplay(r.fechaEjecucion),
      'Fecha Límite (3 días háb.)': formatDateDisplay(r.fechaLimite),
      'Fecha Envío Actas': r.fechaEnvio ? formatDateDisplay(r.fechaEnvio) : 'Pendiente',
      'Temporada': r.temporada === 'alta' ? 'Alta' : 'Baja',
      '% Avance': est.avance + '%',
      '% Retraso': est.retraso + '%',
      'Estado': estadoLabel,
      'Días Retraso': est.diasRetraso,
      'Observaciones': r.observaciones || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Capacitaciones ETI');

  // Ancho de columnas
  ws['!cols'] = [
    {wch:4},{wch:22},{wch:18},{wch:13},{wch:30},{wch:16},{wch:20},{wch:18},{wch:10},{wch:10},{wch:10},{wch:18},{wch:12},{wch:30}
  ];

  const fecha = new Date();
  const nombre = `Capacitaciones_ETI_${fecha.getFullYear()}${String(fecha.getMonth()+1).padStart(2,'0')}${String(fecha.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, nombre);
  showToast('📥 Excel exportado: ' + nombre);
}

// ─── LIMPIAR TODO ─────────────────────────────────────────────
function limpiarTodo() {
  if (!confirm('⚠️ ¿Eliminar TODOS los registros? Esto no se puede deshacer.')) return;
  if (!confirm('¿Confirmas que deseas borrar todos los datos?')) return;
  registros = [];
  guardarStorage();
  renderAll();
  showToast('🗑 Todos los registros han sido eliminados.');
}

// ─── BOTONES ──────────────────────────────────────────────────
function initBotones() {
  document.getElementById('btnExportExcel').addEventListener('click', exportarExcel);
  document.getElementById('btnClearAll').addEventListener('click', limpiarTodo);
}

// ─── STORAGE ──────────────────────────────────────────────────
function cargarRegistros() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    registros = raw ? JSON.parse(raw) : [];
    // Recalcular límites al cargar (por si cambió la lógica)
    registros = registros.map(r => {
      const { fechaLimite, temporada } = calcularFechaLimite(r.fechaEjecucion);
      return { ...r, fechaLimite, temporada };
    });
  } catch(e) {
    registros = [];
  }
}

function guardarStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

// ─── RENDER ALL ───────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderTabla();
  renderRanking();
}

// ─── UTILIDADES ───────────────────────────────────────────────
function formatDate(d) {
  // Returns YYYY-MM-DD
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatDateDisplay(str) {
  if (!str) return '–';
  const [y, m, d] = str.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d}/${meses[parseInt(m)-1]}/${y}`;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showToast(msg, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

// Exponer función global para onclick en tabla
window.abrirModal = abrirModal;
window.eliminarRegistro = eliminarRegistro;
