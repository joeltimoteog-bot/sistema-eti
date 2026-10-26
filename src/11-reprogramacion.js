//  REPROGRAMACIÓN (EDITAR FECHAS CON MOTIVO)
// ════════════════════════════════════════════════
let chartMotivos = null;

let editFechasSel = [];
let editFechasOrig = [];

window.abrirReprog = function(id) {
  const p = programaciones.find(x => x.id === id);
  if(!p) return;
  const rg = rangoProg(p);
  document.getElementById('eProgId').value = id;
  const fechasTxt = rg.fechas.map(f=>formatDateDisplay(f)).join(' · ');
  document.getElementById('eProgInfo').innerHTML = `<strong>${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} — Fechas actuales: <strong>${fechasTxt}</strong> (${rg.dias} día(s))${p.vecesReprogramada?`<br><span style="color:var(--naranja);font-weight:700;">🔄 Ya fue reprogramada ${p.vecesReprogramada} vez/veces</span>`:''}`;
  editFechasOrig = [...rg.fechas];
  editFechasSel = [...rg.fechas];
  document.getElementById('eMotivo').value = '';
  document.getElementById('eDetalle').value = '';
  const _sol = window.etiSolicitudPendiente ? window.etiSolicitudPendiente(p) : null;   /* _SOLREPROG_V1 */
  if(_sol) {
    document.getElementById('eProgInfo').innerHTML += `<div style="margin-top:8px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:7px 9px;font-size:12px;">📝 <b>${esc(_sol.nombre||'')}</b> pidió reprogramar ${(_sol.fechas||[]).map(f=>formatDateDisplay(f)).join(', ')} el ${formatDateDisplay(String(_sol.fecha||'').slice(0,10))}.<br>Motivo: <b>${esc(_sol.motivo||'')}</b> — ${esc(_sol.detalle||'')}</div>`;
    document.getElementById('eDetalle').value = 'Solicitud del supervisor: ' + (_sol.motivo||'') + ' — ' + (_sol.detalle||'');
  }
  document.getElementById('eFechaExtra').value = '';
  renderEFechasList();
  document.getElementById('modalReprog').classList.add('open');
};
window.cerrarReprog = function() { document.getElementById('modalReprog').classList.remove('open'); };

function renderEFechasList() {
  const div = document.getElementById('eFechasList');
  if(!editFechasSel.length) {
    div.innerHTML = '<p class="empty-msg" style="padding:12px;">Sin fechas — agrega al menos una.</p>';
  } else {
    div.innerHTML = editFechasSel.map((f, i) => {
      const orig = editFechasOrig[i];
      const cambiada = orig !== undefined && orig !== f;
      return `<div class="efecha-row">
        <div class="efecha-num">${i+1}</div>
        <input type="date" value="${f}" class="${cambiada?'cambiada':''}" onchange="cambiarFechaE(${i}, this.value)" />
        ${cambiada ? `<span class="efecha-orig">antes: ${formatDateDisplay(orig)} 🔄</span>` : (orig!==undefined ? '<span class="efecha-orig">sin cambio</span>' : '<span class="efecha-orig" style="color:var(--verde);">nueva ➕</span>')}
        <button type="button" class="efecha-x" onclick="quitarFechaE(${i})" title="Quitar esta fecha">✕</button>
      </div>`;
    }).join('');
  }
  document.getElementById('eDias').value = editFechasSel.length ? `${editFechasSel.length} día(s) designado(s)` : '–';
}

window.cambiarFechaE = function(i, val) {
  if(!val) return;
  if(editFechasSel.some((f, j) => j!==i && f===val)) { showToast('⚠️ Esa fecha ya está en la lista', true); renderEFechasList(); return; }
  editFechasSel[i] = val;
  renderEFechasList();
};
window.quitarFechaE = function(i) {
  editFechasSel.splice(i, 1);
  editFechasOrig.splice(i, 1);
  renderEFechasList();
};

window.guardarReprog = async function() {
  const id = document.getElementById('eProgId').value;
  const p = programaciones.find(x => x.id === id);
  if(!p) return;
  const motivo = document.getElementById('eMotivo').value;
  const detalle = document.getElementById('eDetalle').value.trim();

  if(!editFechasSel.length) { showToast('⚠️ Debe quedar al menos una fecha designada', true); return; }
  const nuevas = [...editFechasSel].sort();
  const anteriores = [...fechasDeProg(p)].sort();
  const sinCambio = JSON.stringify(nuevas) === JSON.stringify(anteriores);
  if(sinCambio) { showToast('⚠️ Las fechas son iguales a las actuales. No hay cambio.', true); return; }
  if(!motivo) { showToast('⚠️ El MOTIVO del cambio de fecha es obligatorio', true); document.getElementById('eMotivo').focus(); return; }

  // Detalle de cambios específicos: pares cambiados, quitadas y agregadas
  const cambios = [];
  editFechasOrig.forEach((orig, i) => {
    if(orig !== undefined && editFechasSel[i] !== undefined && orig !== editFechasSel[i])
      cambios.push(`${formatDateDisplay(orig)} → ${formatDateDisplay(editFechasSel[i])}`);
  });
  anteriores.filter(f => !nuevas.includes(f) && !cambios.some(c => c.startsWith(formatDateDisplay(f)))).forEach(f => cambios.push(`${formatDateDisplay(f)} eliminada`));
  nuevas.filter(f => !anteriores.includes(f) && !cambios.some(c => c.endsWith(formatDateDisplay(f)))).forEach(f => cambios.push(`${formatDateDisplay(f)} agregada`));

  const entrada = {
    fechaAnteriorIni: anteriores[0],
    fechaAnteriorFin: anteriores[anteriores.length-1],
    fechasAnterior: anteriores,
    fechasNueva: nuevas,
    nuevaIni: nuevas[0],
    nuevaFin: nuevas[nuevas.length-1],
    cambios: cambios.join(' · '),
    motivo, detalle,
    registradoPor: usuarioActual?.nombre || '',
    fecha: new Date().toISOString()
  };
  try {
    await updateDoc(doc(db, COL_PROG, id), {
      fechaProgramada: nuevas[0],
      fechaFin: nuevas[nuevas.length-1],
      fechas: nuevas,
      diasDesignados: nuevas.length,
      reprogramaciones: [...(p.reprogramaciones||[]), entrada],
      vecesReprogramada: (p.vecesReprogramada||0) + 1,
      ...((p.solicitudesReprog||[]).length && window.etiSolicitudesAtendidas ? { solicitudesReprog: window.etiSolicitudesAtendidas(p.solicitudesReprog, usuarioActual?.nombre || '') } : {})   /* _SOLREPROG_V1 */
    });
    cerrarReprog();
    showToast(`🔄 Reprogramada: ${cambios.join(' · ')}`);
  } catch(e) { showToast('❌ Error al reprogramar', true); }
};

// ─── INDICADOR DE MOTIVOS + HISTORIAL ─────────────────────────
function renderMotivosReprog() {
  const todas = [];
  programaciones.forEach(p => (p.reprogramaciones||[]).forEach(r => todas.push({...r, supervisor:p.supervisor, sector:p.sector, tema:p.tema})));

  // Chart de motivos
  const conteo = {};
  todas.forEach(r => { conteo[r.motivo] = (conteo[r.motivo]||0)+1; });
  const labels = Object.keys(conteo).sort((a,b)=>conteo[b]-conteo[a]);
  const datos = labels.map(l => conteo[l]);
  const colores = ['#0050c8','#cc0000','#c89010','#e07a2a','#1a8040','#6a4c93','#9aaabb'];

  const canvas = document.getElementById('chartMotivos');
  if(canvas) {
    if(!todas.length) {
      if(chartMotivos) { chartMotivos.destroy(); chartMotivos=null; }
      canvas.style.display='none';
    } else {
      canvas.style.display='block';
      if(chartMotivos) { chartMotivos.data.labels=labels; chartMotivos.data.datasets[0].data=datos; chartMotivos.update('none'); }
      else chartMotivos = new Chart(canvas, {type:'doughnut',
        data:{labels, datasets:[{data:datos, backgroundColor:colores, borderWidth:0}]},
        options:{responsive:true, maintainAspectRatio:false, animation:{duration:300}, plugins:{legend:{position:'bottom', labels:{font:{family:'Tahoma',size:9.5}}}}, cutout:'55%'}});
    }
  }

  // Lista resumen
  const lDiv = document.getElementById('listaMotivos');
  if(lDiv) {
    lDiv.innerHTML = !todas.length
      ? '<p class="empty-msg">Sin reprogramaciones registradas aún.</p>'
      : labels.map((l,i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--azul-bg);border-radius:7px;margin-bottom:5px;font-size:11.5px;">
          <span style="font-weight:700;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${colores[i%colores.length]};margin-right:7px;"></span>${esc(l)}</span>
          <span class="badge badge-azul">${conteo[l]} cambio(s)</span>
        </div>`).join('');
  }

  // Historial
  const hDiv = document.getElementById('histReprog');
  if(hDiv) {
    if(!todas.length) { hDiv.innerHTML='<p class="empty-msg">Sin reprogramaciones registradas.</p>'; return; }
    todas.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));
    hDiv.innerHTML = todas.slice(0,15).map(r => {
      let cambioTxt;
      if(r.cambios) {
        cambioTxt = `<strong>${esc(r.cambios)}</strong>`;
      } else {
        const antTxt = r.fechaAnteriorIni===r.fechaAnteriorFin ? formatDateDisplay(r.fechaAnteriorIni) : `${formatDateDisplay(r.fechaAnteriorIni)}–${formatDateDisplay(r.fechaAnteriorFin)}`;
        const nueTxt = r.nuevaIni===r.nuevaFin ? formatDateDisplay(r.nuevaIni) : `${formatDateDisplay(r.nuevaIni)}–${formatDateDisplay(r.nuevaFin)}`;
        cambioTxt = `<span style="color:var(--gris-text);">${antTxt}</span> ➜ <strong>${nueTxt}</strong>`;
      }
      return `<div class="alert-card alert-naranja">
        <span class="alert-icon"><svg class="ico"><use href="#i-refresh"/></svg></span>
        <div style="font-size:11.5px;">
          <strong>${esc(r.supervisor)}</strong> · ${esc(r.sector||'')} · ${esc(r.tema)}<br>
          ${cambioTxt}<br>
          <span class="badge badge-naranja" style="margin-top:3px;">${esc(r.motivo)}</span>${r.detalle?` <span style="font-size:10px;color:var(--gris-text);">— ${esc(r.detalle)}</span>`:''}
        </div>
      </div>`;
    }).join('');
  }
}

// ─── CHIPS DE FECHAS EN FORMULARIO DE PROGRAMACIÓN ────────────
let progFechasSel = [];

function renderPFechasChips() {
  const div = document.getElementById('pFechasChips');
  if(!div) return;
  if(!progFechasSel.length) {
    div.innerHTML = '<span class="empty-chip">Elige fecha inicio (y fin) para generar las fechas, o agrégalas una por una aquí abajo</span>';
  } else {
    div.innerHTML = progFechasSel.map((f, i) =>
      `<span class="fecha-chip">📅 ${formatDateDisplay(f)}<span class="chip-x" onclick="quitarFechaP(${i})" title="Quitar">✕</span></span>`
    ).join('');
  }
  document.getElementById('pDiasDesignados').value = progFechasSel.length
    ? `${progFechasSel.length} día(s) designado(s) para capacitar` : '–';
}

window.quitarFechaP = function(i) {
  progFechasSel.splice(i, 1);
  renderPFechasChips();
};

// ════════════════════════════════════════════════
