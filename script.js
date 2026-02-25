/* ============================================================
   SISTEMA ETI v2.0 – LÓGICA PRINCIPAL
   Autor: Joel A. Timoteo Gonza – Relaciones Laborales
   ============================================================ */

'use strict';

const STORAGE_KEY = 'eti_registros_v3';

const FESTIVOS_PERU = [
  '01-01','04-17','04-18','05-01','06-29','07-28','07-29',
  '08-30','10-08','11-01','12-08','12-09','12-25'
];

let registros = [];
let charts = {};

// ─── INIT ─────────────────────────────────────────────────────
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
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : new Date(fecha);
  const val = (d.getMonth() + 1) * 100 + d.getDate();
  return (val >= 105 && val <= 626) ? 'baja' : 'alta';
}

function esFestivo(fecha) {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return FESTIVOS_PERU.includes(mm + '-' + dd);
}

function esDiaHabil(fecha, temporada) {
  const dow = fecha.getDay();
  if (dow === 0) return false;
  if (temporada === 'baja' && dow === 6) return false;
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
  return { fechaLimite: formatDate(d), temporada };
}

// ─── ESTADO ───────────────────────────────────────────────────
/*
  LÓGICA CORRECTA:
  - En plazo:   avance = (días usados / 3) × 100,  retraso = 0
  - Con envío a tiempo: avance = 100, retraso = 0
  - Con envío tardío:   retraso = (días tardíos / 3) × 100,  avance = 100 - retraso
  - Sin envío y vencido: retraso = (días vencidos / 3) × 100, avance = 100 - retraso
  Ejemplo: 1 día de retraso → retraso=33%, avance=67%
*/
function calcularEstado(reg) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fLimite = new Date(reg.fechaLimite + 'T12:00:00');
  const fEjec   = new Date(reg.fechaEjecucion + 'T12:00:00');
  const fEnvio  = reg.fechaEnvio ? new Date(reg.fechaEnvio + 'T12:00:00') : null;

  // CASO 1: Ya se envió
  if (fEnvio) {
    const diff = Math.round((fEnvio - fLimite) / 86400000);
    if (diff <= 0) {
      // Enviado a tiempo → cumplido 100%
      return { estado: 'cumplido', avance: 100, retraso: 0, diasRetraso: 0 };
    } else {
      // Enviado tarde → retraso = diff/3×100, avance = 100 - retraso
      const pctRetraso = Math.min(Math.round((diff / 3) * 100), 100);
      const pctAvance  = Math.max(100 - pctRetraso, 0);
      return { estado: diff <= 2 ? 'leve' : 'critico', avance: pctAvance, retraso: pctRetraso, diasRetraso: diff };
    }
  }

  // CASO 2: Sin envío y aún en plazo
  if (hoy <= fLimite) {
    const diasUsados = Math.max(0, Math.round((hoy - fEjec) / 86400000));
    const pctAvance  = Math.min(Math.round((diasUsados / 3) * 100), 99); // máx 99% hasta que se envíe
    return { estado: 'proceso', avance: pctAvance, retraso: 0, diasRetraso: 0 };
  }

  // CASO 3: Sin envío y vencido → retraso sube, avance baja
  const diasRet    = Math.round((hoy - fLimite) / 86400000);
  const pctRetraso = Math.min(Math.round((diasRet / 3) * 100), 100);
  const pctAvance  = Math.max(100 - pctRetraso, 0);
  return {
    estado: diasRet <= 2 ? 'leve' : 'critico',
    avance: pctAvance,
    retraso: pctRetraso,
    diasRetraso: diasRet
  };
}

// ─── HEADER ───────────────────────────────────────────────────
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

// ─── FORMULARIO ───────────────────────────────────────────────
function initForm() {
  // Auto-completar sector al elegir supervisor
  document.getElementById('fSupervisor').addEventListener('change', function() {
    const val = this.value;
    if (val) {
      const sector = val.split('|')[1] || '';
      document.getElementById('fSector').value = sector;
    } else {
      document.getElementById('fSector').value = '';
    }
  });

  // Auto-calcular total trabajadores
  ['fVarones','fMujeres'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcularTotal);
  });

  // Radio rutas
  document.querySelectorAll('input[name="tipoRutas"]').forEach(r => {
    r.addEventListener('change', function() {
      document.getElementById('rutasNumeroCont').style.display = this.value === 'numero' ? 'block' : 'none';
      document.getElementById('rutasVariasCont').style.display = this.value === 'varias' ? 'block' : 'none';
    });
  });

  // Cantidad de rutas → generar filas
  document.getElementById('fCantRutas').addEventListener('input', function() {
    generarFilasRutas(parseInt(this.value) || 0);
  });

  document.getElementById('btnPreview').addEventListener('click', mostrarPreview);
  document.getElementById('etiForm').addEventListener('submit', e => { e.preventDefault(); guardarRegistro(); });
}

function calcularTotal() {
  const v = parseInt(document.getElementById('fVarones').value) || 0;
  const m = parseInt(document.getElementById('fMujeres').value) || 0;
  document.getElementById('fTotal').value = (v + m) + ' trabajadores';
}

function generarFilasRutas(cant) {
  const cont = document.getElementById('rutasItemsCont');
  if (cant < 1 || cant > 25) { cont.innerHTML = ''; return; }

  let html = `<div class="ruta-header">
    <span>#</span><span>Código de Ruta</span><span>Nombre de Ruta</span>
  </div>`;

  for (let i = 1; i <= cant; i++) {
    html += `<div class="ruta-item-row">
      <div class="ruta-num">${i}</div>
      <input type="text" class="ruta-codigo" placeholder="Ej: RT-0${i}" maxlength="20" />
      <input type="text" class="ruta-nombre" placeholder="Ej: Ruta Panamericana Norte" maxlength="80" />
    </div>`;
  }
  cont.innerHTML = html;
}

function obtenerRutas() {
  const tipo = document.querySelector('input[name="tipoRutas"]:checked');
  if (!tipo) return { tipo: 'ninguna', rutas: [] };
  if (tipo.value === 'varias') return { tipo: 'varias', rutas: [] };

  const codigos = document.querySelectorAll('.ruta-codigo');
  const nombres = document.querySelectorAll('.ruta-nombre');
  const rutas = [];
  codigos.forEach((c, i) => {
    if (c.value.trim() || nombres[i].value.trim()) {
      rutas.push({ codigo: c.value.trim(), nombre: nombres[i].value.trim() });
    }
  });
  return { tipo: 'detalle', rutas };
}

function mostrarPreview() {
  const fechaE = document.getElementById('fFechaEjecucion').value;
  if (!fechaE) { showToast('Ingresa la fecha de ejecución primero.', true); return; }
  const { fechaLimite, temporada } = calcularFechaLimite(fechaE);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fLim = new Date(fechaLimite + 'T12:00:00');
  const restante = Math.round((fLim - hoy) / 86400000);
  const v = parseInt(document.getElementById('fVarones').value) || 0;
  const m = parseInt(document.getElementById('fMujeres').value) || 0;

  document.getElementById('previewGrid').innerHTML = `
    <div class="preview-item"><div class="p-label">Temporada</div><div class="p-value">${temporada === 'alta' ? '🌡 Alta' : '❄ Baja'}</div></div>
    <div class="preview-item"><div class="p-label">Días hábiles</div><div class="p-value">Lun–${temporada === 'alta' ? 'Sáb' : 'Vie'}</div></div>
    <div class="preview-item highlight"><div class="p-label">Fecha Límite</div><div class="p-value">${formatDateDisplay(fechaLimite)}</div></div>
    <div class="preview-item"><div class="p-label">Estado</div><div class="p-value">${restante >= 0 ? '✅ En plazo' : '🔴 Vencido'}</div></div>
    <div class="preview-item"><div class="p-label">Total capacitados</div><div class="p-value">${v + m} (${v}♂ + ${m}♀)</div></div>
  `;
  document.getElementById('previewBox').style.display = 'block';
}

function guardarRegistro() {
  const supVal    = document.getElementById('fSupervisor').value;
  const varones   = document.getElementById('fVarones').value;
  const mujeres   = document.getElementById('fMujeres').value;
  const tema      = document.getElementById('fTema').value.trim();
  const fechaEjec = document.getElementById('fFechaEjecucion').value;
  const fechaEnvio= document.getElementById('fFechaEnvio').value;
  const obs       = document.getElementById('fObservaciones').value.trim();

  if (!supVal || varones === '' || mujeres === '' || !tema || !fechaEjec) {
    showToast('Completa todos los campos obligatorios (*).', true);
    return;
  }

  const [supervisor, sector] = supVal.split('|');
  const v = parseInt(varones) || 0;
  const m = parseInt(mujeres) || 0;
  const { fechaLimite, temporada } = calcularFechaLimite(fechaEjec);
  const rutasData = obtenerRutas();

  const reg = {
    id: Date.now().toString(),
    supervisor, sector,
    varones: v, mujeres: m, total: v + m,
    tema, fechaEjecucion: fechaEjec,
    fechaLimite, fechaEnvio: fechaEnvio || null,
    temporada, observaciones: obs,
    rutasTipo: rutasData.tipo,
    rutas: rutasData.rutas,
    creadoEn: new Date().toISOString()
  };

  registros.push(reg);
  guardarStorage();
  renderAll();

  // Reset
  document.getElementById('etiForm').reset();
  document.getElementById('fSector').value = '';
  document.getElementById('fTotal').value = '';
  document.getElementById('previewBox').style.display = 'none';
  document.getElementById('rutasNumeroCont').style.display = 'none';
  document.getElementById('rutasVariasCont').style.display = 'none';
  document.getElementById('rutasItemsCont').innerHTML = '';

  showToast('✅ Registro guardado correctamente.');

  // Ir a tabla
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="tabla"]').classList.add('active');
  document.getElementById('tab-tabla').classList.add('active');
  renderTabla();
}

// ─── TABLA ────────────────────────────────────────────────────
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
    tbody.innerHTML = `<tr><td colspan="16" class="no-records">No hay registros que mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map((r, i) => {
    const est = calcularEstado(r);
    const badgeClass = { cumplido:'badge-cumplido', proceso:'badge-proceso', leve:'badge-leve', critico:'badge-critico' }[est.estado];
    const estadoLabel = { cumplido:'✔ Cumplido', proceso:'⏳ En proceso', leve:'⚠ Retraso leve', critico:'🔴 Retraso crítico' }[est.estado];

    // Rutas resumen
    let rutasCell = '<span class="cell-muted">–</span>';
    if (r.rutasTipo === 'varias') rutasCell = '<span class="badge badge-baja">Rutas Varias</span>';
    else if (r.rutasTipo === 'detalle' && r.rutas && r.rutas.length > 0) {
      rutasCell = `<span title="${r.rutas.map(x=>x.codigo+' '+x.nombre).join(', ')}">${r.rutas.length} ruta(s)</span>`;
    }

    const colorRetraso = est.retraso > 50 ? 'fill-red' : 'fill-orange';

    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(r.supervisor)}</strong></td>
      <td>${esc(r.sector)}</td>
      <td class="text-right"><strong style="color:#3a7bd5">${r.varones}</strong></td>
      <td class="text-right"><strong style="color:#e07a2a">${r.mujeres}</strong></td>
      <td class="text-right"><strong>${r.total}</strong></td>
      <td>${esc(r.tema)}</td>
      <td>${rutasCell}</td>
      <td>${formatDateDisplay(r.fechaEjecucion)}</td>
      <td>${formatDateDisplay(r.fechaLimite)}</td>
      <td>${r.fechaEnvio ? formatDateDisplay(r.fechaEnvio) : '<span class="cell-muted">–</span>'}</td>
      <td><span class="badge ${r.temporada === 'alta' ? 'badge-alta' : 'badge-baja'}">${r.temporada === 'alta' ? '🌡 Alta' : '❄ Baja'}</span></td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill fill-green" style="width:${est.avance}%"></div></div>
          <span class="progress-pct" style="color:var(--green-bright)">${est.avance}%</span>
        </div>
      </td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill ${colorRetraso}" style="width:${est.retraso}%"></div></div>
          <span class="progress-pct" style="color:${est.retraso > 0 ? 'var(--red)' : 'var(--text-muted)'}">${est.retraso}%</span>
        </div>
      </td>
      <td><span class="badge ${badgeClass}">${estadoLabel}</span></td>
      <td>
        <button class="btn btn-icon" onclick="abrirModal('${r.id}')" title="Editar">✏️</button>
        <button class="btn btn-icon" onclick="eliminarRegistro('${r.id}')" title="Eliminar">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  let cumplido = 0, proceso = 0, leve = 0, critico = 0;
  const alertas = [];

  registros.forEach(r => {
    const est = calcularEstado(r);
    if (est.estado === 'cumplido') cumplido++;
    else if (est.estado === 'proceso') proceso++;
    else if (est.estado === 'leve') leve++;
    else critico++;

    const motivo = r.observaciones ? r.observaciones : 'Sin observaciones registradas';
    if (est.estado === 'critico') {
      alertas.push({ tipo:'critico', texto:`<strong>${r.supervisor}</strong> – ${r.sector} lleva <strong>${est.diasRetraso} día(s)</strong> de retraso crítico.`, extra: r.tema, motivo });
    } else if (est.estado === 'leve') {
      alertas.push({ tipo:'leve', texto:`<strong>${r.supervisor}</strong> – ${r.sector} tiene retraso leve (<strong>${est.diasRetraso} día/s</strong>).`, extra: r.tema, motivo });
    } else if (est.estado === 'proceso') {
      const restante = Math.round((new Date(r.fechaLimite+'T12:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
      if (restante <= 1) alertas.push({ tipo:'proceso', texto:`<strong>${r.supervisor}</strong> vence ${restante === 0 ? '<strong>HOY</strong>' : 'MAÑANA'} – ${r.sector}.`, extra: r.tema, motivo: '' });
    }
  });

  const total = registros.length;
  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiCumplido').textContent = cumplido;
  document.getElementById('kpiProceso').textContent = proceso;
  document.getElementById('kpiRetraso').textContent = leve + critico;
  document.getElementById('kpiPct').textContent = total > 0 ? Math.round((cumplido/total)*100)+'%' : '0%';

  const alertsList = document.getElementById('alertsList');
  if (alertas.length === 0) {
    alertsList.innerHTML = '<p class="empty-msg">✅ Sin alertas activas. Todo en orden.</p>';
  } else {
    const icons = { critico:'🔴', leve:'⚠️', proceso:'⏰' };
    alertsList.innerHTML = alertas.map(a => `
      <div class="alert-item alert-${a.tipo}">
        <span class="alert-icon">${icons[a.tipo]}</span>
        <div class="alert-text">
          <span>${a.texto}</span>
          <small style="display:block;margin-top:3px;opacity:.8">📚 Tema: ${a.extra}</small>
          ${a.motivo ? `<small style="display:block;margin-top:2px;color:inherit;font-style:italic">📝 Motivo retraso: ${a.motivo}</small>` : ''}
        </div>
      </div>`).join('');
  }

  renderCharts(cumplido, proceso, leve, critico);
}

function renderCharts(cumplido, proceso, leve, critico) {
  const destroyC = (id) => { const c = Chart.getChart(id); if(c) c.destroy(); };

  destroyC('chartEstado');
  new Chart(document.getElementById('chartEstado'), {
    type: 'doughnut',
    data: { labels:['Cumplido','En Proceso','Retraso Leve','Retraso Crítico'], datasets:[{ data:[cumplido,proceso,leve,critico], backgroundColor:['#2ea86a','#3a7bd5','#e07a2a','#e05252'], borderWidth:0 }] },
    options: { responsive:true, plugins:{ legend:{ position:'bottom', labels:{ font:{ family:'DM Sans', size:11 } } } }, cutout:'65%' }
  });

  const supMap = {};
  registros.forEach(r => {
    if (!supMap[r.supervisor]) supMap[r.supervisor] = { c:0, t:0 };
    supMap[r.supervisor].t++;
    if (calcularEstado(r).estado === 'cumplido') supMap[r.supervisor].c++;
  });
  const supLabels = Object.keys(supMap);
  const supPct = supLabels.map(s => Math.round((supMap[s].c/supMap[s].t)*100));

  destroyC('chartSupervisor');
  new Chart(document.getElementById('chartSupervisor'), {
    type:'bar',
    data:{ labels:supLabels.map(s=>s.split(' ')[0]), datasets:[{ label:'% Cumplimiento', data:supPct, backgroundColor:'#1a6645', borderRadius:6 }] },
    options:{ responsive:true, indexAxis:'y', plugins:{ legend:{ display:false } }, scales:{ x:{ max:100, ticks:{ callback:v=>v+'%' } } } }
  });

  const mesMap = {};
  const mNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  registros.forEach(r => { const m = new Date(r.fechaEjecucion+'T12:00:00').getMonth(); mesMap[m]=(mesMap[m]||0)+1; });
  const mesKeys = Object.keys(mesMap).sort((a,b)=>a-b);

  destroyC('chartMes');
  new Chart(document.getElementById('chartMes'), {
    type:'line',
    data:{ labels:mesKeys.map(k=>mNombres[k]), datasets:[{ label:'Registros', data:mesKeys.map(k=>mesMap[k]), borderColor:'#2ea86a', backgroundColor:'rgba(46,168,106,.1)', tension:.4, fill:true, pointRadius:5 }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } } }
  });

  const alta = registros.filter(r=>r.temporada==='alta').length;
  destroyC('chartTemporada');
  new Chart(document.getElementById('chartTemporada'), {
    type:'pie',
    data:{ labels:['Temporada Alta','Temporada Baja'], datasets:[{ data:[alta, registros.length-alta], backgroundColor:['#e8b94a','#3a7bd5'], borderWidth:0 }] },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ font:{ family:'DM Sans', size:11 } } } } }
  });
}

// ─── RANKING ──────────────────────────────────────────────────
function renderRanking() {
  const cont = document.getElementById('rankingContainer');
  if (registros.length === 0) { cont.innerHTML = '<p class="empty-msg">No hay registros para generar ranking.</p>'; return; }

  const map = {};
  registros.forEach(r => {
    if (!map[r.supervisor]) map[r.supervisor] = { c:0, p:0, ret:0, t:0, sector:r.sector };
    map[r.supervisor].t++;
    const e = calcularEstado(r).estado;
    if (e==='cumplido') map[r.supervisor].c++;
    else if (e==='proceso') map[r.supervisor].p++;
    else map[r.supervisor].ret++;
  });

  const ranking = Object.entries(map)
    .map(([n,d])=>({ n, ...d, pct: Math.round((d.c/d.t)*100) }))
    .sort((a,b)=>b.pct-a.pct||a.ret-b.ret);

  const medals = ['gold','silver','bronze'];
  cont.innerHTML = ranking.map((r,i) => `
    <div class="ranking-card ${i<3?'rank'+(i+1):''}">
      <div class="ranking-pos ${medals[i]||''}">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</div>
      <div class="ranking-info">
        <h4>${esc(r.n)}</h4>
        <p>${esc(r.sector)} · ${r.t} registro(s) · ${r.c} cumplidos · ${r.ret} retraso(s)</p>
      </div>
      <div class="ranking-pct">${r.pct}%</div>
    </div>`).join('');
}

// ─── MODAL EDITAR ─────────────────────────────────────────────
function initModal() {
  document.getElementById('modalClose').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelEdit').addEventListener('click', cerrarModal);
  document.getElementById('modalOverlay').addEventListener('click', e => { if(e.target===document.getElementById('modalOverlay')) cerrarModal(); });
  document.getElementById('editForm').addEventListener('submit', e => { e.preventDefault(); guardarEdicion(); });

  document.getElementById('eSupervisor').addEventListener('change', function() {
    const v = this.value;
    document.getElementById('eSector').value = v ? v.split('|')[1] || '' : '';
  });
}

function abrirModal(id) {
  const reg = registros.find(r => r.id === id);
  if (!reg) return;
  document.getElementById('editId').value = id;
  // Reconstruir valor del select
  const supVal = reg.supervisor + '|' + reg.sector;
  document.getElementById('eSupervisor').value = supVal;
  document.getElementById('eSector').value = reg.sector;
  document.getElementById('eVarones').value = reg.varones;
  document.getElementById('eMujeres').value = reg.mujeres;
  document.getElementById('eTema').value = reg.tema;
  document.getElementById('eFechaEjecucion').value = reg.fechaEjecucion;
  document.getElementById('eFechaEnvio').value = reg.fechaEnvio || '';
  document.getElementById('eObservaciones').value = reg.observaciones || '';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function guardarEdicion() {
  const id = document.getElementById('editId').value;
  const idx = registros.findIndex(r => r.id === id);
  if (idx === -1) return;

  const supVal = document.getElementById('eSupervisor').value;
  const [supervisor, sector] = supVal.split('|');
  const fechaEjec = document.getElementById('eFechaEjecucion').value;
  const { fechaLimite, temporada } = calcularFechaLimite(fechaEjec);
  const v = parseInt(document.getElementById('eVarones').value) || 0;
  const m = parseInt(document.getElementById('eMujeres').value) || 0;

  registros[idx] = {
    ...registros[idx],
    supervisor, sector,
    varones: v, mujeres: m, total: v + m,
    tema: document.getElementById('eTema').value.trim(),
    fechaEjecucion: fechaEjec, fechaLimite, temporada,
    fechaEnvio: document.getElementById('eFechaEnvio').value || null,
    observaciones: document.getElementById('eObservaciones').value.trim()
  };

  guardarStorage();
  renderAll();
  cerrarModal();
  showToast('✏️ Registro actualizado.');
}

// ─── ELIMINAR ─────────────────────────────────────────────────
function eliminarRegistro(id) {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
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
    const estadoLabel = { cumplido:'Cumplido', proceso:'En Proceso', leve:'Retraso Leve', critico:'Retraso Crítico' }[est.estado];
    let rutasStr = '–';
    if (r.rutasTipo === 'varias') rutasStr = 'Rutas Varias';
    else if (r.rutas && r.rutas.length > 0) rutasStr = r.rutas.map(x => `[${x.codigo}] ${x.nombre}`).join(' | ');

    return {
      '#': i+1,
      'Supervisor': r.supervisor,
      'Sector': r.sector,
      'Varones Capacitados': r.varones,
      'Mujeres Capacitadas': r.mujeres,
      'Total Trabajadores': r.total,
      'Tema': r.tema,
      'Rutas': rutasStr,
      'Fecha Ejecución': formatDateDisplay(r.fechaEjecucion),
      'Fecha Límite (3 días háb.)': formatDateDisplay(r.fechaLimite),
      'Fecha Envío Actas': r.fechaEnvio ? formatDateDisplay(r.fechaEnvio) : 'Pendiente',
      'Temporada': r.temporada === 'alta' ? 'Alta' : 'Baja',
      '% Avance': est.avance+'%',
      '% Retraso': est.retraso+'%',
      'Estado': estadoLabel,
      'Días Retraso': est.diasRetraso,
      'Observaciones': r.observaciones || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Capacitaciones ETI');
  ws['!cols'] = [{wch:4},{wch:24},{wch:20},{wch:10},{wch:10},{wch:8},{wch:28},{wch:40},{wch:14},{wch:20},{wch:16},{wch:10},{wch:10},{wch:10},{wch:16},{wch:10},{wch:30}];

  const f = new Date();
  XLSX.writeFile(wb, `ETI_${f.getFullYear()}${String(f.getMonth()+1).padStart(2,'0')}${String(f.getDate()).padStart(2,'0')}.xlsx`);
  showToast('📥 Excel exportado correctamente.');
}

// ─── LIMPIAR TODO ─────────────────────────────────────────────
function limpiarTodo() {
  if (!confirm('⚠️ ¿Eliminar TODOS los registros?')) return;
  if (!confirm('¿Confirmas que deseas borrar todos los datos?')) return;
  registros = [];
  guardarStorage();
  renderAll();
  showToast('🗑 Todos los registros eliminados.');
}

function initBotones() {
  document.getElementById('btnExportExcel').addEventListener('click', exportarExcel);
  document.getElementById('btnClearAll').addEventListener('click', limpiarTodo);
}

// ─── STORAGE ──────────────────────────────────────────────────
function cargarRegistros() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    registros = raw ? JSON.parse(raw) : [];
    registros = registros.map(r => {
      const { fechaLimite, temporada } = calcularFechaLimite(r.fechaEjecucion);
      return { ...r, fechaLimite, temporada };
    });
  } catch(e) { registros = []; }
}

function guardarStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
}

function renderAll() {
  renderDashboard();
  renderTabla();
  renderRanking();
}

// ─── UTILS ────────────────────────────────────────────────────
function formatDate(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function formatDateDisplay(str) {
  if (!str) return '–';
  const [y,m,d] = str.split('-');
  const mn = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d}/${mn[parseInt(m)-1]}/${y}`;
}
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg, isError=false) {
  const e = document.querySelector('.toast');
  if (e) e.remove();
  const t = document.createElement('div');
  t.className = 'toast'+(isError?' error':'');
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); },3500);
}

window.abrirModal = abrirModal;
window.eliminarRegistro = eliminarRegistro;
