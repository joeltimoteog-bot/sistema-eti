//  MI PANEL — MÓDULO DE REGISTRO PARA SUPERVISORES
// ════════════════════════════════════════════════
function initPanelSupervisor() {
  const upd = () => {
    const v=parseInt(document.getElementById('sVarones').value)||0;
    const m=parseInt(document.getElementById('sMujeres').value)||0;
    document.getElementById('sTotalCalc').value=(v+m)+' trabajadores';
  };
  ['sVarones','sMujeres'].forEach(id => document.getElementById(id)?.addEventListener('input', upd));
  document.getElementById('sCodigos')?.addEventListener('input', function() {
    setText('sCodigosCount', parseCodigos(this.value).length + ' códigos ingresados');
  });
  document.getElementById('btnSupGuardar')?.addEventListener('click', guardarRegistroSupervisor);
  document.getElementById('btnSupCancelar')?.addEventListener('click', cerrarFormSup);
}

function cerrarFormSup() {
  document.getElementById('supFormPanel').style.display='none';
  ['sProgId','sFechaEjec','sVarones','sMujeres','sRutas','sCodigos','sObs'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  document.getElementById('sTotalCalc').value='0 trabajadores';
  setText('sCodigosCount','0 códigos ingresados');
}

function renderPanelSupervisor() {
  if(!usuarioActual || usuarioActual.rol!=='supervisor') return;
  const nombre = usuarioActual.nombre;
  const mias = programaciones.filter(p => esMiaProg(p, nombre)).map(p => ({...p, _est: estadoProg(p)}));   /* _COBERTURAS_ETI_V1 */
  const pendientes = mias.filter(p => p._est.key!=='ejecutada');
  const vencidas = pendientes.filter(p => p._est.key==='vencida');
  const proximas = pendientes.filter(p => p._est.key==='proxima' && p._est.dias<=3);
  const misRegs = registros.filter(r => r.supervisor===nombre);

  setText('skPendientes', pendientes.length);
  setText('skProximas', proximas.length);
  setText('skVencidas', vencidas.length);
  setText('skEjecutadas', misRegs.length);

  const ncSup = document.getElementById('navCountSup');
  if(ncSup) {
    const n = vencidas.length + pendientes.filter(p=>p._est.key==='hoy'||p._est.key==='curso').length;
    ncSup.style.display = n ? 'inline-flex' : 'none';
    ncSup.textContent = n;
  }

  // Lista de programaciones del supervisor
  const div = document.getElementById('supProgramaciones');
  if(div) {
    const orden = {vencida:0, curso:1, hoy:1, proxima:2, ejecutada:3};
    const lista = [...mias].sort((a,b) => orden[a._est.key]-orden[b._est.key] || (a.fechaProgramada||'').localeCompare(b.fechaProgramada||''));
    if(!lista.length) div.innerHTML = '<p class="empty-msg">No tienes capacitaciones programadas aún.</p>';
    else div.innerHTML = lista.map(p => {
      const rg = rangoProg(p);
      const d = new Date(rg.ini+'T12:00:00');
      const MESES=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
      const cls = p._est.key==='vencida'?'vencida':(p._est.key==='hoy'||p._est.key==='curso')?'hoy-curso':p._est.key==='ejecutada'?'ejecutada':'proxima';
      const fechasTxt = rg.ini===rg.fin ? formatDateDisplay(rg.ini) : `${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)} (${rg.dias} días)`;
      return `<div class="prog-card ${cls}">
        <div class="prog-card-fecha"><div class="pcf-dia">${d.getDate()}</div><div class="pcf-mes">${MESES[d.getMonth()]}</div></div>
        <div class="prog-card-info">
          <div class="prog-card-tema">${esc(p.tema)}</div>
          <div class="prog-card-meta">${esc(p.sector||'')} · Fechas: ${fechasTxt}${p.observaciones?`<br>Nota: ${esc(p.observaciones)}`:''}</div>
        </div>
        <span class="badge ${p._est.badge}">${p._est.label}${p._est.key==='vencida'?` · ${p._est.dias} día(s) de atraso`:p._est.key==='proxima'?` · en ${p._est.dias} día(s)`:''}</span>
        ${p._est.key!=='ejecutada' ? `<button class="btn btn-primary btn-sm" onclick="abrirRegistroSup('${p.id}')"><svg class="ico sm"><use href="#i-plus"/></svg> Registrar</button>` : ''}
        ${p._est.key==='vencida' ? ((window.etiSolicitudPendiente && window.etiSolicitudPendiente(p)) ? `<span class="badge badge-naranja" title="${esc(window.etiSolicitudPendiente(p).motivo||'')}">⏳ Reprogramación solicitada</span>` : `<button class="btn btn-secondary btn-sm" onclick="etiSolicitarReprog('${p.id}')" title="No se realizó: informar el motivo y pedir reprogramación">📝 No se realizó</button>`) : ''}
      </div>`;
    }).join('');
  }

  // Mis registros enviados
  const rDiv = document.getElementById('supMisRegistros');
  if(rDiv) {
    if(!misRegs.length) rDiv.innerHTML = '<p class="empty-msg">Aún no has registrado capacitaciones.</p>';
    else rDiv.innerHTML = misRegs.slice(0,10).map(r => `
      <div class="alert-card alert-verde">
        <span class="alert-icon"><svg class="ico"><use href="#i-check-circle"/></svg></span>
        <div><strong>${esc(r.tema)}</strong> · ${formatDateDisplay(r.fechaEjecucion)}<br>
        ${r.total||0} trabajadores (${r.varones||0} V · ${r.mujeres||0} M)${(r.codigosCapacitados||[]).length?` · ${r.codigosCapacitados.length} códigos`:''}${r.rutasTexto?` · Rutas: ${esc(r.rutasTexto)}`:''}</div>
      </div>`).join('');
  }

  // Aviso permanente + apertura automática del formulario
  renderAvisoSupervisor(pendientes);
}

// Elige la programación pendiente más urgente del supervisor
function progMasUrgente(pendientes) {
  const orden = {vencida:0, curso:1, hoy:1, proxima:2};
  const lista = [...pendientes].sort((a,b) => {
    const d = orden[a._est.key]-orden[b._est.key];
    if(d!==0) return d;
    if(a._est.key==='vencida') return b._est.dias-a._est.dias; // más atrasada primero
    return (a._est.dias||0)-(b._est.dias||0); // más cercana primero
  });
  return lista[0] || null;
}

// Banner de aviso al supervisor + abrir su formulario automáticamente al entrar
function renderAvisoSupervisor(pendientes) {
  const banner = document.getElementById('supAvisoBanner');
  if(!banner) return;
  const urgente = progMasUrgente(pendientes);
  if(!urgente) { banner.style.display='none'; return; }

  const rg = rangoProg(urgente);
  const fechasTxt = rg.fechas.map(f=>formatDateDisplay(f)).join(', ');
  const esVencida = urgente._est.key==='vencida';
  banner.className = 'alert-card ' + (esVencida ? 'alert-rojo' : 'alert-amarillo');
  banner.style.display = 'flex';
  banner.innerHTML = `
    <span class="alert-icon"><svg class="ico"><use href="#i-bell"/></svg></span>
    <div style="line-height:1.65;">
      <strong style="font-size:13px;">${esVencida ? '🚨 Tienes una capacitación programada VENCIDA' : '📋 Tienes una capacitación programada'}</strong><br>
      <strong>${esc(urgente.tema)}</strong> · ${esc(urgente.sector||'')} — fecha(s): <strong>${fechasTxt}</strong>${esVencida?` · <strong style="color:var(--rojo);">${urgente._est.dias} día(s) hábil(es) de atraso</strong>`:''}.<br>
      Por favor registra los datos solicitados en el formulario. Si aún no la has realizado, recuerda que
      <strong>se está evaluando el cumplimiento y la responsabilidad de las actividades programadas</strong>.
      <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="abrirRegistroSup('${urgente.id}')"><svg class="ico sm"><use href="#i-plus"/></svg> Registrar ahora</button></div>
    </div>`;

  // Al iniciar sesión: abrir el formulario automáticamente (una sola vez)
  if(!avisoSupMostrado && dataProgCargada) {
    avisoSupMostrado = true;
    setTimeout(() => abrirRegistroSup(urgente.id), 600);
  }
}

window.abrirRegistroSup = function(id) {
  const p = programaciones.find(x => x.id===id);
  if(!p) return;
  const rg = rangoProg(p);
  document.getElementById('sProgId').value = id;
  document.getElementById('sFechaEjec').value = rg.fin <= formatDate(new Date()) ? rg.fin : formatDate(new Date());
  document.getElementById('supProgInfo').style.display='flex';
  document.getElementById('supProgInfoTxt').innerHTML = `Registrando: <strong>${esc(p.tema)}</strong> · ${esc(p.sector||'')} · fechas designadas: <strong>${rg.fechas.map(f=>formatDateDisplay(f)).join(' · ')}</strong>`;
  document.getElementById('supFormPanel').style.display='block';
  document.getElementById('supFormPanel').scrollIntoView({behavior:'smooth', block:'start'});
};

async function guardarRegistroSupervisor() {
  const progId = document.getElementById('sProgId').value;
  const p = programaciones.find(x => x.id===progId);
  if(!p) { showToast('Selecciona una programación de la lista (botón Registrar).', true); return; }
  const fechaE = document.getElementById('sFechaEjec').value;
  const vTxt = document.getElementById('sVarones').value;
  const mTxt = document.getElementById('sMujeres').value;
  if(!fechaE || vTxt==='' || mTxt==='') { showToast('Completa fecha, varones y mujeres.', true); return; }
  const v = parseInt(vTxt)||0, m = parseInt(mTxt)||0;
  if(v+m<=0) { showToast('El total de capacitados debe ser mayor a 0.', true); return; }
  const rutasTxt = document.getElementById('sRutas').value.trim();
  const codigos = parseCodigos(document.getElementById('sCodigos').value);
  const obs = document.getElementById('sObs').value.trim();
  const {fechaLimite, temporada} = calcularFechaLimite(fechaE);

  /* _COBERTURAS_ETI_V1: si quien registra está cubriendo al titular, el registro queda a su nombre "en reemplazo de …" */
  let _cob = null; try { const c = cobDeProg(p); if (c && esReemplazoDe(p, usuarioActual.nombre)) _cob = c; } catch (e) {}
  const reg = {
    supervisor: _cob ? usuarioActual.nombre : p.supervisor, sector: p.sector||'', varones:v, mujeres:m, total:v+m,
    ...(_cob ? { cubreA: p.supervisor, cobertura: {titular:_cob.titular, titular_nombre:_cob.titular_nombre, tipo:_cob.tipo, desde:_cob.desde, hasta:_cob.hasta||'', id:_cob.id||''} } : {}),
    tema: p.tema, fechaEjecucion: fechaE, fechaLimite, temporada,
    fechaEnvio: null, observaciones: obs,
    tipoPersonal:'', rutasTipo: rutasTxt?'texto':'ninguna', rutas:[], rutasTexto: rutasTxt,
    areas:[], codigosCapacitados: codigos,
    registradoPor: usuarioActual.nombre, viaSupervisor: true,
    creadoEn: new Date().toISOString()
  };
  try {
    const refDoc = await addDoc(collection(db, COL), reg);
    try { await _fsUpdateDoc(doc(db, COL_PROG, progId), {estado:'ejecutada', registroId:refDoc.id, ejecutadaEn:new Date().toISOString()}); }
    catch(e2) { console.error('Error al marcar programación:', e2); }
    cerrarFormSup();
    showToast('✅ Capacitación registrada. ¡Gracias! Relaciones Laborales ya puede verla.');
  } catch(e) {
    console.error(e);
    showToast('❌ Error al guardar. Verifica tu conexión.', true);
  }
}

// ════════════════════════════════════════════════
