//  CAMPANA DE NOTIFICACIONES Y RESUMEN DE VENCIMIENTOS
// ════════════════════════════════════════════════
function initNotificaciones() {
  const btn = document.getElementById('btnNotif');
  const panel = document.getElementById('notifPanel');
  if(!btn || !panel) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if(panel.classList.contains('open') && !panel.contains(e.target) && e.target!==btn) panel.classList.remove('open');
  });
}

// Calcula todas las alertas de vencimiento vigentes
function calcularAlertas() {
  const esSup = usuarioActual?.rol === 'supervisor';
  const miNombre = usuarioActual?.nombre;

  let progs = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  let regs = registros.map(r => ({...r, ...calcularEstado(r)}));
  if(esSup) {
    progs = progs.filter(p => esMiaProg(p, miNombre));   /* _COBERTURAS_ETI_V1 */
    regs = regs.filter(r => r.supervisor === miNombre);
  }

  const alertas = [];
  // Programaciones vencidas (lo más urgente)
  progs.filter(p => p._est.key==='vencida').sort((a,b)=>b._est.dias-a._est.dias).forEach(p => {
    alertas.push({tipo:'rojo', icono:'i-alert', titulo:`Programación VENCIDA — ${supLbl(p)}`,
      detalle:`${p.tema} · ${p.sector||''}`, meta:`${p._est.dias} día(s) hábil(es) de atraso · fechas: ${fechasDeProg(p).map(f=>formatDateDisplay(f)).join(', ')}`, urgente:true});
  });
  // Para hoy / en curso
  progs.filter(p => p._est.key==='hoy' || p._est.key==='curso').forEach(p => {
    alertas.push({tipo:'ambar', icono:'i-clock', titulo:`${p._est.key==='hoy'?'Programada para HOY':'En curso'} — ${supLbl(p)}`,
      detalle:`${p.tema} · ${p.sector||''}`, meta: p._est.key==='curso'?`Día ${p._est.diaActual} de ${p._est.diasTot} designados`:'Ejecutar y registrar hoy', urgente:false});
  });
  // Próximas a vencer (3, 2, 1 días)
  progs.filter(p => p._est.key==='proxima' && p._est.dias<=3).sort((a,b)=>a._est.dias-b._est.dias).forEach(p => {
    alertas.push({tipo:'azul', icono:'i-calendar', titulo:`${p._est.dias===1?'Vence MAÑANA':'En '+p._est.dias+' días'} — ${supLbl(p)}`,
      detalle:`${p.tema} · ${p.sector||''}`, meta:`Programada para el ${formatDateDisplay(p.fechaProgramada)}`, urgente:false});
  });
  // Actas con retraso
  regs.filter(r => r.estado==='leve'||r.estado==='critico').sort((a,b)=>b.diasRetraso-a.diasRetraso).forEach(r => {
    alertas.push({tipo:'rojo', icono:'i-send', titulo:`Actas con retraso — ${r.supervisor}`,
      detalle:`${r.tema} · ejecutada el ${formatDateDisplay(r.fechaEjecucion)}`, meta:`${r.diasRetraso} día(s) hábil(es) de retraso · límite era ${formatDateDisplay(r.fechaLimite)}`, urgente:true});
  });
  // Actas por vencer (avance >= 66%)
  regs.filter(r => r.estado==='proceso' && r.avance>=66).forEach(r => {
    alertas.push({tipo:'naranja', icono:'i-clock', titulo:`Actas por vencer — ${r.supervisor}`,
      detalle:`${r.tema} · ${r.sector||''}`, meta:`Enviar actas antes del ${formatDateDisplay(r.fechaLimite)}`, urgente:false});
  });
  return alertas;
}

function renderNotificaciones() {
  const dot = document.getElementById('notifDot');
  const bell = document.getElementById('btnNotif');
  const body = document.getElementById('notifBody');
  if(!dot || !bell || !body) return;

  const alertas = calcularAlertas();
  const urgentes = alertas.filter(a => a.urgente).length;

  // Contador en campana y en menú lateral
  dot.style.display = alertas.length ? 'flex' : 'none';
  dot.textContent = alertas.length > 99 ? '99+' : alertas.length;
  bell.classList.toggle('has-alerts', alertas.length>0);
  bell.classList.toggle('urgente', urgentes>0);
  setText('notifResumen', alertas.length ? `${alertas.length} alerta(s) · ${urgentes} urgente(s)` : 'Todo al día');

  const ncProg = document.getElementById('navCountProg');
  if(ncProg) {
    const nVenc = programaciones.filter(p => estadoProg(p).key==='vencida').length;
    ncProg.style.display = nVenc ? 'inline-flex' : 'none';
    ncProg.textContent = nVenc;
  }

  if(!alertas.length) {
    body.innerHTML = `<div class="notif-empty"><svg class="ico"><use href="#i-check-circle"/></svg><br>Sin alertas de vencimiento.<br>Todo al día.</div>`;
  } else {
    body.innerHTML = alertas.slice(0,20).map(a => `
      <div class="notif-item n-${a.tipo}">
        <div class="n-icon"><svg class="ico sm"><use href="#${a.icono}"/></svg></div>
        <div><strong>${esc(a.titulo)}</strong><br>${esc(a.detalle)}<div class="n-meta">${esc(a.meta)}</div></div>
      </div>`).join('');
  }

  mostrarResumenSiCorresponde(alertas);
}

// Modal de resumen al iniciar sesión (una vez por sesión)
// Para supervisores NO se muestra: ellos reciben el aviso automático
// con su formulario de registro abierto (ver avisoAutomaticoSupervisor)
function mostrarResumenSiCorresponde(alertas) {
  if(resumenMostrado || !usuarioActual) return;
  if(usuarioActual.rol === 'supervisor') { resumenMostrado = true; return; }
  if(!dataRegsCargada || !dataProgCargada) return;
  resumenMostrado = true;
  if(!alertas.length) return;

  const nVencidas = alertas.filter(a => a.icono==='i-alert').length;
  const nHoy = alertas.filter(a => a.tipo==='ambar').length;
  const nProx = alertas.filter(a => a.tipo==='azul').length;
  const nActas = alertas.filter(a => a.icono==='i-send' || a.tipo==='naranja').length;

  document.getElementById('resumenContent').innerHTML = `
    <div class="resumen-alertas-head">
      <div class="resumen-alertas-icon"><svg class="ico lg"><use href="#i-bell"/></svg></div>
      <div style="font-size:13px;line-height:1.6;">Hola <strong>${esc(usuarioActual.nombre.split(' ')[0])}</strong>, tienes <strong>${alertas.length} alerta(s)</strong> de vencimiento que requieren tu atención.</div>
    </div>
    <div class="resumen-stats">
      ${nVencidas?`<div class="resumen-stat rs-rojo"><div class="rs-num">${nVencidas}</div><div class="rs-label">Vencidas</div></div>`:''}
      ${nHoy?`<div class="resumen-stat rs-ambar"><div class="rs-num">${nHoy}</div><div class="rs-label">Hoy / En curso</div></div>`:''}
      ${nProx?`<div class="resumen-stat rs-azul"><div class="rs-num">${nProx}</div><div class="rs-label">Próximas ≤3 días</div></div>`:''}
      ${nActas?`<div class="resumen-stat rs-naranja rs-ambar"><div class="rs-num">${nActas}</div><div class="rs-label">Actas</div></div>`:''}
    </div>
    <div style="max-height:220px;overflow-y:auto;">
      ${alertas.slice(0,6).map(a=>`
        <div class="notif-item n-${a.tipo}" style="border:1px solid var(--linea);">
          <div class="n-icon"><svg class="ico sm"><use href="#${a.icono}"/></svg></div>
          <div><strong>${esc(a.titulo)}</strong><div class="n-meta">${esc(a.meta)}</div></div>
        </div>`).join('')}
      ${alertas.length>6?`<p style="font-size:11px;color:var(--texto-3);text-align:center;margin-top:6px;">y ${alertas.length-6} alerta(s) más — revisa la campana de notificaciones</p>`:''}
    </div>`;
  document.getElementById('modalResumen').classList.add('open');
}
window.cerrarResumen = function() { document.getElementById('modalResumen').classList.remove('open'); };

// ════════════════════════════════════════════════
