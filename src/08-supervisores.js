// ════════════════════════════════════════════════
//  SUPERVISORES DINÁMICOS
// ════════════════════════════════════════════════
function escucharSupervisores() {
  const q = query(collection(db, COL_SUPS), orderBy('nombre'));
  unsubSups = onSnapshot(q, async snap => {
    if(snap.empty) {
      // Seed inicial una sola vez
      for(const s of SUPS_SEED) {
        await addDoc(collection(db, COL_SUPS), {...s, estado:'activo', creadoEn:new Date().toISOString()});
      }
      return; // el snapshot se volverá a disparar con los datos
    }
    supervisores = snap.docs.map(d => ({id:d.id, ...d.data()}));
    poblarSelectsSupervisores();
    renderListaSups();
  }, err => console.error('Sups error:', err));
}

function poblarSelectsSupervisores() {
  const activos = supervisores.filter(s => s.estado === 'activo');
  const opts = activos.map(s => `<option value="${esc(s.nombre)}|${esc(s.sector)}">${esc(s.nombre)} – ${esc(s.sector.replace(/^SECTOR\s*/i,''))}</option>`).join('');
  [['fSupervisor','— Seleccionar supervisor —'],['pSupervisor','— Seleccionar —'],['pFiltSup','Todos los supervisores'],['uSupervisor','— Seleccionar supervisor —']].forEach(([id,first]) => {
    const el = document.getElementById(id);
    if(!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${first}</option>` + ((id==='pFiltSup'||id==='uSupervisor')
      ? [...new Set(activos.map(s=>s.nombre))].map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')
      : opts);
    el.value = cur;
  });
}

window.abrirModalSups = function() {
  document.getElementById('nsNombre').value='';
  document.getElementById('nsSector').value='';
  renderListaSups();
  document.getElementById('modalSups').classList.add('open');
};
window.cerrarModalSups = function() {
  document.getElementById('modalSups').classList.remove('open');
};

window.guardarNuevoSup = async function() {
  const nombre = document.getElementById('nsNombre').value.trim().toUpperCase();
  let sector = document.getElementById('nsSector').value.trim().toUpperCase();
  if(!nombre || !sector) { showToast('Completa nombre y sector', true); return; }
  if(!sector.startsWith('SECTOR')) sector = 'SECTOR ' + sector;
  // Evitar duplicado exacto
  if(supervisores.some(s => s.nombre===nombre && s.sector===sector && s.estado==='activo')) {
    showToast('⚠️ Ese supervisor con ese sector ya existe', true); return;
  }
  try {
    await addDoc(collection(db, COL_SUPS), {nombre, sector, estado:'activo', creadoEn:new Date().toISOString()});
    document.getElementById('nsNombre').value='';
    document.getElementById('nsSector').value='';
    showToast(`✅ Supervisor "${nombre}" registrado`);
  } catch(e) { showToast('❌ Error al guardar', true); }
};

function renderListaSups() {
  const div = document.getElementById('listaSups');
  if(!div) return;
  if(!supervisores.length) { div.innerHTML='<p class="empty-msg">Sin supervisores.</p>'; return; }
  const esAdmin = usuarioActual?.rol === 'admin';
  div.innerHTML = supervisores.map(s => `
    <div class="sup-item ${s.estado!=='activo'?'inactivo':''}">
      <div>
        <div style="font-weight:700;font-size:12px;">${esc(s.nombre)}</div>
        <div style="font-size:10px;color:var(--gris-text);">${esc(s.sector)} ${s.estado!=='activo'?'· <span style="color:var(--rojo);font-weight:700;">INACTIVO</span>':''}</div>
      </div>
      <div style="display:flex;gap:5px;">
        ${s.estado==='activo'
          ? `<button class="btn btn-danger btn-sm" onclick="toggleSup('${s.id}','inactivo')" title="Desactivar"><svg class="ico sm"><use href="#i-lock"/></svg></button>`
          : `<button class="btn btn-success btn-sm" onclick="toggleSup('${s.id}','activo')" title="Reactivar"><svg class="ico sm"><use href="#i-check"/></svg></button>`}
        ${esAdmin?`<button class="btn btn-danger btn-sm" onclick="eliminarSup('${s.id}')" title="Eliminar"><svg class="ico sm"><use href="#i-trash"/></svg></button>`:''}
      </div>
    </div>`).join('');
}

window.toggleSup = async function(id, estado) {
  try { await updateDoc(doc(db, COL_SUPS, id), {estado}); showToast(estado==='activo'?'✅ Supervisor reactivado':'⛔ Supervisor desactivado'); }
  catch(e) { showToast('Error', true); }
};

window.eliminarSup = async function(id) {
  if(usuarioActual?.rol!=='admin') { showToast('Solo administradores', true); return; }
  if(!confirm('¿Eliminar este supervisor? El historial de capacitaciones se conserva.')) return;
  try { await deleteDoc(doc(db, COL_SUPS, id)); showToast('🗑 Supervisor eliminado'); }
  catch(e) { showToast('Error', true); }
};

// ════════════════════════════════════════════════
