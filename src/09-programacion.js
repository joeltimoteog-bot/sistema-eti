//  PROGRAMACIÓN DE CAPACITACIONES (PROYECCIÓN)
// ════════════════════════════════════════════════
function escucharProgramaciones() {
  const q = query(collection(db, COL_PROG), orderBy('fechaProgramada'));
  unsubProg = onSnapshot(q, snap => {
    programaciones = snap.docs.map(d => ({id:d.id, ...d.data()}));
    dataProgCargada = true;
    renderProgramaciones();
    renderDashboard(); // refresca alertas y KPIs
    renderPanelSupervisor();
  }, err => console.error('Prog error:', err));
}

function initProgramacion() {
  document.getElementById('pSupervisor').addEventListener('change', function() {
    document.getElementById('pSector').value = this.value ? this.value.split('|')[1]||'' : '';
  });
  // Fechas designadas en vivo (chips) — se generan del rango y se pueden ajustar una por una
  const regenerarFechas = () => {
    const ini = document.getElementById('pFecha').value;
    let fin = document.getElementById('pFechaFin').value;
    if(!ini) { progFechasSel=[]; renderPFechasChips(); return; }
    if(!fin) fin = ini;
    if(fin < ini) { document.getElementById('pDiasDesignados').value='⚠️ Fecha fin inválida'; return; }
    progFechasSel = fechasHabilesDelRango(ini, fin);
    renderPFechasChips();
  };
  document.getElementById('pFecha').addEventListener('change', regenerarFechas);
  document.getElementById('pFechaFin').addEventListener('change', regenerarFechas);
  document.getElementById('btnAddFecha').addEventListener('click', () => {
    const f = document.getElementById('pFechaExtra').value;
    if(!f) { showToast('Elige una fecha para agregar', true); return; }
    if(progFechasSel.includes(f)) { showToast('⚠️ Esa fecha ya está en la lista', true); return; }
    progFechasSel.push(f);
    progFechasSel.sort();
    document.getElementById('pFechaExtra').value='';
    renderPFechasChips();
  });
  // Modal editar: agregar fecha
  document.getElementById('btnAddFechaE').addEventListener('click', () => {
    const f = document.getElementById('eFechaExtra').value;
    if(!f) { showToast('Elige una fecha para agregar', true); return; }
    if(editFechasSel.includes(f)) { showToast('⚠️ Esa fecha ya está en la lista', true); return; }
    editFechasSel.push(f);
    document.getElementById('eFechaExtra').value='';
    renderEFechasList();
  });
  document.getElementById('btnProgGuardar').addEventListener('click', guardarProgramacion);
  document.getElementById('btnProgLimpiar').addEventListener('click', limpiarProg);
  document.getElementById('pFiltSup').addEventListener('change', renderProgramaciones);
  document.getElementById('pFiltEstado').addEventListener('change', renderProgramaciones);
  document.getElementById('btnProgExcel').addEventListener('click', exportProgExcel);
  document.getElementById('btnIncumplPdf').addEventListener('click', exportIncumplimientosPDF);
  document.getElementById('modalSups').addEventListener('click', function(e){if(e.target===this)cerrarModalSups();});
  // Modal reprogramación
  document.getElementById('modalReprog').addEventListener('click', function(e){if(e.target===this)cerrarReprog();});
  // Navegación calendario
  document.getElementById('btnCalPrev').addEventListener('click', () => { calMes--; if(calMes<0){calMes=11;calAnio--;} renderCalendario(); });
  document.getElementById('btnCalNext').addEventListener('click', () => { calMes++; if(calMes>11){calMes=0;calAnio++;} renderCalendario(); });
  document.getElementById('btnCalHoy').addEventListener('click', () => { const h=new Date(); calMes=h.getMonth(); calAnio=h.getFullYear(); renderCalendario(); });
}

async function guardarProgramacion() {
  const supVal = document.getElementById('pSupervisor').value;
  const tema = document.getElementById('pTema').value;
  const fecha = document.getElementById('pFecha').value;
  let fechaFin = document.getElementById('pFechaFin').value;
  const obs = document.getElementById('pObs').value.trim();
  if(!supVal || !tema || !fecha) { showToast('Completa supervisor, tema y fecha de inicio', true); return; }
  if(fechaFin && fechaFin < fecha) { showToast('⚠️ La fecha fin no puede ser anterior a la fecha inicio', true); return; }
  if(!fechaFin) fechaFin = fecha; // un solo día
  const [supervisor, sector] = supVal.split('|');
  // Usar las fechas seleccionadas en los chips (permiten fechas no consecutivas)
  const fechas = progFechasSel.length ? [...progFechasSel].sort() : fechasHabilesDelRango(fecha, fechaFin);
  if(!fechas.length) { showToast('⚠️ No hay fechas designadas válidas', true); return; }
  try {
    await addDoc(collection(db, COL_PROG), {
      supervisor, sector, tema,
      fechaProgramada: fechas[0],
      fechaFin: fechas[fechas.length-1],
      fechas,
      diasDesignados: fechas.length,
      observaciones: obs,
      estado: 'pendiente',
      registroId: null,
      creadoPor: usuarioActual?.nombre || '',
      creadoEn: new Date().toISOString()
    });
    limpiarProg();
    showToast(`📅 Programado: ${fechas.length} día(s) designado(s) para el sector`);
  } catch(e) { showToast('❌ Error al programar', true); }
}

// Días hábiles del rango INCLUSIVE (según temporada de cada día)
function diasHabilesRango(iniStr, finStr) {
  let count = 0;
  let d = new Date(iniStr + 'T12:00:00');
  const fin = new Date(finStr + 'T12:00:00');
  while(d <= fin) {
    if(esDiaHabil(d, detectarTemporada(d))) count++;
    d.setDate(d.getDate()+1);
  }
  return count || 1;
}

// Obtener rango normalizado de una programación (compatible con las antiguas de un solo día)
function rangoProg(p) {
  const fechas = fechasDeProg(p);
  return { ini: fechas[0], fin: fechas[fechas.length-1], dias: fechas.length, fechas };
}

// Array de fechas designadas de una programación (soporta fechas específicas no consecutivas)
function fechasDeProg(p) {
  if(p.fechas && p.fechas.length) return [...p.fechas].sort();
  const ini = p.fechaProgramada;
  const fin = p.fechaFin || p.fechaProgramada;
  return fechasHabilesDelRango(ini, fin);
}

// Fechas hábiles de un rango como array (según temporada de cada día)
function fechasHabilesDelRango(iniStr, finStr) {
  const out = [];
  let d = new Date(iniStr + 'T12:00:00');
  const fin = new Date(finStr + 'T12:00:00');
  while(d <= fin) {
    if(esDiaHabil(d, detectarTemporada(d))) out.push(formatDate(d));
    d.setDate(d.getDate()+1);
  }
  return out.length ? out : [iniStr];
}

function limpiarProg() {
  ['pSupervisor','pSector','pTema','pFecha','pFechaFin','pObs','pFechaExtra'].forEach(id => document.getElementById(id).value='');
  document.getElementById('pDiasDesignados').value='–';
  progFechasSel = [];
  renderPFechasChips();
}

/* ═══ _COBERTURAS_ETI_V1 (18-oct-2026): reemplazos registrados en el Sistema RR.LL. (Gestión de usuarios › Ausencia).
   Si en las fechas de una programación su supervisor estaba ausente con reemplazo, la programación la responde el
   reemplazo: la ve en su panel, la registra a su nombre "en reemplazo de …" y las alertas lo nombran a él. ═══ */
function cobDeProg(p) {
  try {
    if (!window.ETICob || !p || p.estado === 'ejecutada') return null;
    const cta = usuariosCuentas.find(c => (c.supervisorNombre||'') === p.supervisor);
    for (const f of fechasDeProg(p)) {
      const c = (cta && ETICob.deTitular(cta.usuario, f)) || ETICob.deTitular(p.supervisor, f);
      if (c) return c;
    }
  } catch (e) {}
  return null;
}
function esReemplazoDe(p, nombre) {
  const c = cobDeProg(p); if (!c || !window.ETICob) return false;
  const cta = usuariosCuentas.find(x => (x.supervisorNombre||'') === nombre);
  return (cta && ETICob.mismo(cta.usuario, c.reemplazo)) || ETICob.mismo(nombre, c.reemplazo_nombre) || (usuarioActual && ETICob.mismo(usuarioActual.usuario||'', c.reemplazo));
}
function esMiaProg(p, nombre) { const c = cobDeProg(p); return c ? esReemplazoDe(p, nombre) : p.supervisor === nombre; }
function supLbl(p) { const c = cobDeProg(p); return c ? `${ETICob.titulo(c.reemplazo_nombre || c.reemplazo)} (🔄 ${ETICob.texto(c)})` : p.supervisor; }
window.addEventListener('eti-coberturas', () => { try { renderProgramaciones(); } catch (e) {} try { renderNotificaciones(); } catch (e) {} try { renderPanelSupervisor(); } catch (e) {} });

// Estado calculado de una programación (soporta rango de días designados)
function estadoProg(p) {
  if(p.estado === 'ejecutada') return {key:'ejecutada', label:'Ejecutada', badge:'badge-verde', dias:0};
  const {ini, fin, dias} = rangoProg(p);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fIni = new Date(ini + 'T12:00:00'); fIni.setHours(0,0,0,0);
  const fFin = new Date(fin + 'T12:00:00'); fFin.setHours(0,0,0,0);

  // Hoy dentro del rango designado → EN CURSO (o "Para hoy" si es 1 solo día)
  if(hoy >= fIni && hoy <= fFin) {
    if(fIni.getTime() === fFin.getTime()) return {key:'hoy', label:'Para HOY', badge:'badge-amarillo', dias:0};
    const hoyStr = formatDate(hoy);
    const fechasP = fechasDeProg(p);
    const diaActual = Math.max(1, fechasP.filter(f => f <= hoyStr).length);
    return {key:'curso', label:`En Curso (día ${diaActual} de ${dias})`, badge:'badge-naranja', dias:0, diaActual, diasTot:dias};
  }
  if(fIni > hoy) {
    const diasCal = Math.round((fIni - hoy) / 86400000);
    return {key:'proxima', label:'Próxima', badge:'badge-azul', dias:diasCal};
  }
  // Vencida: días hábiles de atraso DESDE EL ÚLTIMO DÍA designado
  const dr = contarDiasHabiles(fFin, hoy);
  return {key:'vencida', label:'Vencida', badge:'badge-rojo', dias:dr};
}

function renderProgramaciones() {
  /* _COBERTURAS_ETI_V1: aviso de reemplazos vigentes (registrados en el Sistema RR.LL.) */
  try {
    const tab = document.getElementById('tab-programacion');
    if (tab) {
      let bx = document.getElementById('pCobBanner');
      if (!bx) { bx = document.createElement('div'); bx.id = 'pCobBanner'; tab.insertBefore(bx, tab.firstChild); }
      const V = window.ETICob ? ETICob.vigentes() : [];
      bx.innerHTML = V.length ? `<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12.5px;line-height:1.6"><strong style="color:#3730A3">🔄 Reemplazos vigentes</strong> <span style="color:#64748b">(se registran en Sistema RR.LL. › Gestión de usuarios › Ausencia)</span><br>${V.map(c => `• <strong>${esc(ETICob.titulo(c.reemplazo_nombre||c.reemplazo))}</strong> ${esc(ETICob.texto(c))}`).join('<br>')}</div>` : '';
    }
  } catch (e) {}
  // KPIs
  const conEst = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  setText('pkTotal', programaciones.length);
  setText('pkProximas', conEst.filter(p => p._est.key==='proxima' && p._est.dias<=3).length);
  setText('pkHoy', conEst.filter(p => p._est.key==='hoy' || p._est.key==='curso').length);
  setText('pkVencidas', conEst.filter(p => p._est.key==='vencida').length);
  setText('pkEjecutadas', conEst.filter(p => p._est.key==='ejecutada').length);

  // Eficacia de programación: ejecutadas / (ejecutadas + vencidas)
  const nEjec = conEst.filter(p => p._est.key==='ejecutada').length;
  const nVenc = conEst.filter(p => p._est.key==='vencida').length;
  const eficacia = (nEjec+nVenc) ? Math.round((nEjec/(nEjec+nVenc))*100) : null;
  setText('pkEficacia', eficacia===null ? '–' : eficacia+'%');
  setText('kEficacia', eficacia===null ? '–' : eficacia+'%');

  // KPI reprogramadas
  setText('pkReprog', programaciones.filter(p => (p.vecesReprogramada||0)>0).length);

  // Indicador de motivos + historial
  renderMotivosReprog();

  // Calendario visual
  renderCalendario();

  // Tabla con filtros
  const fSup = document.getElementById('pFiltSup').value;
  const fEst = document.getElementById('pFiltEstado').value;
  let data = [...conEst];
  if(fSup) data = data.filter(p => p.supervisor === fSup);
  if(fEst) data = data.filter(p => p._est.key === fEst);
  // Orden: vencidas primero, luego hoy, próximas, ejecutadas al final
  const ordenKey = {vencida:0, curso:1, hoy:1, proxima:2, ejecutada:3};
  data.sort((a,b) => ordenKey[a._est.key]-ordenKey[b._est.key] || a.fechaProgramada.localeCompare(b.fechaProgramada));

  const tbody = document.getElementById('tbodyProg');
  if(!data.length) { tbody.innerHTML='<tr><td colspan="9" class="empty-msg">Sin programaciones que coincidan.</td></tr>'; return; }
  const esAdmin = usuarioActual?.rol === 'admin';
  tbody.innerHTML = data.map((p,i) => {
    const e = p._est;
    const diasTxt = e.key==='vencida' ? `<strong style="color:var(--rojo);">${e.dias} hábil(es) atraso</strong>`
      : e.key==='proxima' ? `${e.dias} día(s)` : '–';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(p.supervisor)}</strong>${cobDeProg(p)?`<br><span style="font-size:10px;font-weight:700;color:#4338CA">🔄 La cubre ${esc(ETICob.titulo(cobDeProg(p).reemplazo_nombre||cobDeProg(p).reemplazo))} · ${esc(ETICob.tipoTxt(cobDeProg(p).tipo))}</span>`:''}</td>
      <td style="font-size:10.5px;">${esc(p.sector||'')}</td>
      <td style="font-size:10.5px;">${esc(p.tema)}</td>
      <td style="font-weight:700;">${(() => {
        const rg = rangoProg(p);
        const reprogBadge = (p.vecesReprogramada>0) ? `<br><span class="badge badge-naranja" style="font-size:8.5px;" title="${esc((p.reprogramaciones||[]).map(x=>x.motivo).join(', '))}">🔄 Reprogramada x${p.vecesReprogramada}</span>` : '';
        const _solP = window.etiSolicitudPendiente ? window.etiSolicitudPendiente(p) : null;   /* _SOLREPROG_V1 */
        const solBadge = _solP ? `<br><span class="badge badge-rojo" style="font-size:8.5px;" title="${esc((_solP.nombre||'')+': '+(_solP.motivo||'')+' — '+(_solP.detalle||''))}">📝 Pide reprogramar: ${esc(_solP.motivo||'')}</span>` : '';
        const consec = rg.fechas.length === fechasHabilesDelRango(rg.ini, rg.fin).length;
        const fechasTitle = rg.fechas.map(f=>formatDateDisplay(f)).join(' · ');
        return (rg.ini===rg.fin
          ? formatDateDisplay(rg.ini)
          : consec
            ? `${formatDateDisplay(rg.ini)} – ${formatDateDisplay(rg.fin)}<br><span style="font-size:9px;color:var(--azul-mid);">📆 ${rg.dias} día(s) designado(s)</span>`
            : `<span title="${fechasTitle}">${formatDateDisplay(rg.ini)} … ${formatDateDisplay(rg.fin)}</span><br><span style="font-size:9px;color:var(--naranja);" title="${fechasTitle}">📆 ${rg.dias} fechas específicas: ${fechasTitle}</span>`) + reprogBadge + solBadge;
      })()}</td>
      <td><span class="badge ${e.badge}">${e.label}</span></td>
      <td>${diasTxt}</td>
      <td style="max-width:140px;font-size:10px;">${esc((p.observaciones||'').substring(0,40))}${(p.observaciones||'').length>40?'…':''}</td>
      <td style="white-space:nowrap;">
        ${p.estado!=='ejecutada' ? `<button class="btn btn-success btn-sm" onclick="ejecutarProg('${p.id}')" title="Registrar ejecución"><svg class="ico sm"><use href="#i-play"/></svg></button>` : ''}
        ${p.estado!=='ejecutada' ? `<button class="btn btn-secondary btn-sm" onclick="abrirReprog('${p.id}')" title="Editar / Reprogramar fechas"><svg class="ico sm"><use href="#i-edit"/></svg></button>` : ''}
        ${esAdmin || p.estado!=='ejecutada' ? `<button class="btn btn-danger btn-sm" onclick="eliminarProg('${p.id}')" title="Eliminar"><svg class="ico sm"><use href="#i-trash"/></svg></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// Ejecutar: lleva al formulario Registrar prellenado y vinculado
window.ejecutarProg = function(id) {
  const p = programaciones.find(x => x.id === id);
  if(!p) return;
  document.querySelector('[data-tab="registro"]').click();
  const sel = document.getElementById('fSupervisor');
  sel.value = p.supervisor + '|' + p.sector;
  document.getElementById('fSector').value = p.sector || '';
  document.getElementById('fTema').value = p.tema;
  document.getElementById('bloqueTipoPersonal').style.display = 'block';
  const rgEj = rangoProg(p);
  document.getElementById('fFechaEjecucion').value = rgEj.fin; // el plazo de actas corre desde el ÚLTIMO día designado
  document.getElementById('fProgId').value = id;
  document.getElementById('progVinculadaBanner').style.display = 'flex';
  verificarRetrasoForm();
  showToast('🔗 Completa los datos y guarda para marcar la programación como ejecutada');
  window.scrollTo({top:0, behavior:'smooth'});
};

window.desvincularProg = function() {
  document.getElementById('fProgId').value = '';
  document.getElementById('progVinculadaBanner').style.display = 'none';
};

window.eliminarProg = async function(id) {
  if(!confirm('¿Eliminar esta programación?')) return;
  try { await deleteDoc(doc(db, COL_PROG, id)); showToast('🗑 Programación eliminada'); }
  catch(e) { showToast('Error', true); }
};

function exportProgExcel() {
  if(!programaciones.length) { showToast('Sin datos', true); return; }
  const data = programaciones.map(p => {
    const e = estadoProg(p);
    return {
      'Supervisor': p.supervisor, 'Sector': p.sector||'', 'Tema': p.tema,
      'Fecha Inicio': p.fechaProgramada,
      'Fecha Fin': p.fechaFin||p.fechaProgramada,
      'Fechas Designadas': fechasDeProg(p).join(', '),
      'Días Designados': rangoProg(p).dias,
      'Estado': e.label,
      'Días': e.key==='vencida' ? e.dias+' hábiles de atraso' : e.key==='proxima' ? 'faltan '+e.dias : '',
      'Reprogramaciones': p.vecesReprogramada||0,
      'Motivos de Cambio': (p.reprogramaciones||[]).map(r=>r.motivo).join('; '),
      'Observaciones': p.observaciones||'', 'Programado Por': p.creadoPor||''
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Programaciones');
  XLSX.writeFile(wb, `ETI_Programaciones_${formatDate(new Date())}.xlsx`);
  showToast('📥 Excel exportado');
}

// ════════════════════════════════════════════════
//  INFORME DE INCUMPLIMIENTOS (PDF)
// ════════════════════════════════════════════════
function exportIncumplimientosPDF() {
  const progVencidas = programaciones.map(p => ({...p, _est: estadoProg(p)})).filter(p => p._est.key === 'vencida');
  const actasRetraso = registros.map(r => ({...r, ...calcularEstado(r)})).filter(r => r.estado==='leve' || r.estado==='critico');

  if(!progVencidas.length && !actasRetraso.length) {
    showToast('✅ No hay incumplimientos que reportar. ¡Todo al día!');
    return;
  }

  const {jsPDF} = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  let y = 18;

  pdf.setFontSize(15); pdf.setTextColor(153,0,0); pdf.setFont(undefined,'bold');
  pdf.text('INFORME DE INCUMPLIMIENTOS — CAPACITACIONES ETI', 15, y); y+=7;
  pdf.setFontSize(9.5); pdf.setTextColor(80,80,80); pdf.setFont(undefined,'normal');
  pdf.text(`Verfrut · Relaciones Laborales · Generado: ${formatDateDisplay(formatDate(new Date()))} · Sistema ETI v5.0`, 15, y); y+=4;
  pdf.setDrawColor(153,0,0); pdf.line(15, y, 195, y); y+=9;

  // Resumen
  pdf.setFontSize(11); pdf.setTextColor(0,26,94); pdf.setFont(undefined,'bold');
  pdf.text('RESUMEN', 15, y); y+=6.5;
  pdf.setFontSize(10); pdf.setTextColor(40,40,40); pdf.setFont(undefined,'normal');
  pdf.text(`• Capacitaciones programadas NO ejecutadas (vencidas): ${progVencidas.length}`, 18, y); y+=6;
  pdf.text(`• Actas con retraso en envío: ${actasRetraso.length}`, 18, y); y+=6;
  pdf.text(`• Total de casos de incumplimiento: ${progVencidas.length + actasRetraso.length}`, 18, y); y+=11;

  // Sección 1: Programaciones vencidas
  if(progVencidas.length) {
    pdf.setFontSize(12); pdf.setTextColor(153,0,0); pdf.setFont(undefined,'bold');
    pdf.text('1. CAPACITACIONES PROGRAMADAS NO EJECUTADAS', 15, y); y+=8;
    progVencidas.sort((a,b) => b._est.dias - a._est.dias);
    progVencidas.forEach((p, i) => {
      if(y > 262) { pdf.addPage(); y = 18; }
      pdf.setFontSize(10); pdf.setTextColor(20,20,20); pdf.setFont(undefined,'bold');
      pdf.text(`CASO ${i+1}: ${p.supervisor}`, 18, y); y+=5.5;
      pdf.setFontSize(9); pdf.setTextColor(70,70,70); pdf.setFont(undefined,'normal');
      pdf.text(`Sector: ${p.sector||'–'}  ·  Tema: ${p.tema}`, 21, y); y+=5;
      const rgPdf = rangoProg(p);
      const fTxt = rgPdf.ini===rgPdf.fin ? formatDateDisplay(rgPdf.ini) : `${formatDateDisplay(rgPdf.ini)} al ${formatDateDisplay(rgPdf.fin)} (${rgPdf.dias} días designados)`;
      pdf.text(`Fechas designadas: ${fTxt}  ·  Atraso: ${p._est.dias} día(s) hábil(es) desde el último día`, 21, y); y+=5;
      const sit = p.observaciones ? `Situación: ${p.observaciones}` : 'Situación: Sin observaciones registradas — requiere justificación del supervisor.';
      const sitLines = pdf.splitTextToSize(sit, 168);
      sitLines.forEach(l => { if(y>270){pdf.addPage();y=18;} pdf.text(l, 21, y); y+=4.5; });
      // Historial de reprogramaciones del caso
      if(p.reprogramaciones && p.reprogramaciones.length) {
        pdf.setTextColor(180,90,20);
        pdf.text(`Reprogramada ${p.reprogramaciones.length} vez/veces:`, 21, y); y+=4.5;
        p.reprogramaciones.forEach(rr => {
          if(y>270){pdf.addPage();y=18;}
          let cambioT;
          if(rr.cambios) cambioT = rr.cambios;
          else {
            const antT = rr.fechaAnteriorIni===rr.fechaAnteriorFin ? formatDateDisplay(rr.fechaAnteriorIni) : `${formatDateDisplay(rr.fechaAnteriorIni)} al ${formatDateDisplay(rr.fechaAnteriorFin)}`;
            const nueT = rr.nuevaIni===rr.nuevaFin ? formatDateDisplay(rr.nuevaIni) : `${formatDateDisplay(rr.nuevaIni)} al ${formatDateDisplay(rr.nuevaFin)}`;
            cambioT = `${antT} → ${nueT}`;
          }
          const linea = `  - ${cambioT} · Motivo: ${rr.motivo}${rr.detalle?` (${rr.detalle})`:''}`;
          const rrLines = pdf.splitTextToSize(linea, 165);
          rrLines.forEach(l => { if(y>270){pdf.addPage();y=18;} pdf.text(l, 23, y); y+=4.3; });
        });
        pdf.setTextColor(70,70,70);
      }
      y+=4;
    });
    y+=4;
  }

  // Sección 2: Actas con retraso
  if(actasRetraso.length) {
    if(y > 240) { pdf.addPage(); y = 18; }
    pdf.setFontSize(12); pdf.setTextColor(153,0,0); pdf.setFont(undefined,'bold');
    pdf.text('2. ACTAS CON RETRASO EN ENVÍO', 15, y); y+=8;
    actasRetraso.sort((a,b) => b.diasRetraso - a.diasRetraso);
    actasRetraso.forEach((r, i) => {
      if(y > 258) { pdf.addPage(); y = 18; }
      pdf.setFontSize(10); pdf.setTextColor(20,20,20); pdf.setFont(undefined,'bold');
      pdf.text(`CASO ${i+1}: ${r.supervisor} ${r.estado==='critico'?'[CRÍTICO]':'[LEVE]'}`, 18, y); y+=5.5;
      pdf.setFontSize(9); pdf.setTextColor(70,70,70); pdf.setFont(undefined,'normal');
      pdf.text(`Sector: ${r.sector||'–'}  ·  Tema: ${r.tema}  ·  ${r.total||0} trabajadores`, 21, y); y+=5;
      pdf.text(`Ejecutada: ${formatDateDisplay(r.fechaEjecucion)}  ·  Límite: ${formatDateDisplay(r.fechaLimite)}  ·  Envío: ${r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'PENDIENTE'}`, 21, y); y+=5;
      pdf.text(`Retraso: ${r.diasRetraso} día(s) hábil(es)`, 21, y); y+=5;
      const mot = r.observaciones ? `Motivo: ${r.observaciones}` : 'Motivo: NO REGISTRADO — requiere justificación del supervisor.';
      const motLines = pdf.splitTextToSize(mot, 168);
      motLines.forEach(l => { if(y>270){pdf.addPage();y=18;} pdf.text(l, 21, y); y+=4.5; });
      y+=4;
    });
  }

  // Pie de firmas
  if(y > 240) { pdf.addPage(); y = 25; } else y+=12;
  pdf.setDrawColor(150,150,150);
  pdf.line(25, y+14, 85, y+14); pdf.line(125, y+14, 185, y+14);
  pdf.setFontSize(9); pdf.setTextColor(80,80,80);
  pdf.text('Coordinador de Relaciones Laborales', 30, y+19);
  pdf.text('Jefatura de Gestión Humana', 133, y+19);

  pdf.save(`Informe_Incumplimientos_ETI_${formatDate(new Date())}.pdf`);
  showToast('📄 Informe de incumplimientos descargado');
}

// ─── ALERTAS DE PROGRAMACIÓN (Dashboard) ──────────────────────
function renderAlertasProg() {
  const div = document.getElementById('dashAlertasProg');
  if(!div) return;
  const conEst = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  const vencidas = conEst.filter(p => p._est.key==='vencida').sort((a,b)=>b._est.dias-a._est.dias);
  const enCurso = conEst.filter(p => p._est.key==='curso');
  const paraHoy = conEst.filter(p => p._est.key==='hoy');
  const proximas = conEst.filter(p => p._est.key==='proxima' && p._est.dias<=3).sort((a,b)=>a._est.dias-b._est.dias);

  if(!vencidas.length && !enCurso.length && !paraHoy.length && !proximas.length) {
    div.innerHTML = '<p class="empty-msg">✅ Sin programaciones próximas ni vencidas.</p>';
    return;
  }
  let html = '';
  vencidas.slice(0,5).forEach(p => {
    const rg = rangoProg(p);
    const fechasTxt = rg.ini===rg.fin ? `el <strong>${formatDateDisplay(rg.ini)}</strong>` : `del <strong>${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)}</strong> (${rg.dias} días designados)`;
    html += `<div class="alert-card alert-rojo"><span class="alert-icon"><svg class="ico"><use href="#i-alert"/></svg></span><div><strong>INCUMPLIMIENTO — ${esc(supLbl(p))}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} programada ${fechasTxt} — <strong>${p._est.dias} día(s) hábil(es) de atraso</strong></div></div>`;
  });
  enCurso.forEach(p => {
    const rg = rangoProg(p);
    html += `<div class="alert-card alert-amarillo"><span class="alert-icon"><svg class="ico"><use href="#i-activity"/></svg></span><div><strong>EN CURSO — ${esc(supLbl(p))}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} — <strong>día ${p._est.diaActual} de ${p._est.diasTot} designados</strong> (${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)}). Al terminar el último día, registra la ejecución.</div></div>`;
  });
  paraHoy.forEach(p => {
    html += `<div class="alert-card alert-amarillo"><span class="alert-icon"><svg class="ico"><use href="#i-clock"/></svg></span><div><strong>HOY — ${esc(supLbl(p))}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} programada para <strong>hoy</strong>. No olvides ejecutarla y registrarla.</div></div>`;
  });
  proximas.slice(0,4).forEach(p => {
    html += `<div class="alert-card alert-azul"><span class="alert-icon"><svg class="ico"><use href="#i-calendar"/></svg></span><div><strong>Próxima — ${esc(supLbl(p))}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} el <strong>${formatDateDisplay(p.fechaProgramada)}</strong> (en ${p._est.dias} día(s))</div></div>`;
  });
  if(vencidas.length) {
    html += `<div style="margin-top:8px;"><button class="btn btn-pdf btn-sm" onclick="document.getElementById('btnIncumplPdf').click()"><svg class="ico sm"><use href="#i-file"/></svg> Generar Informe de Incumplimientos</button></div>`;
  }
  div.innerHTML = html;
}
