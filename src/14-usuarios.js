//  GESTIÓN DE CUENTAS DE USUARIOS (ADMIN)
// ════════════════════════════════════════════════
function escucharUsuarios() {
  if(usuarioActual?.rol !== 'admin') return;
  const q = query(collection(db, COL_USERS), orderBy('supervisorNombre'));
  unsubUsers = onSnapshot(q, snap => {
    usuariosCuentas = snap.docs.map(d => ({id:d.id, ...d.data()}));
    renderListaUsuarios();
  }, err => console.error('Users error:', err));
}

function initUsuariosAdmin() {
  document.getElementById('btnUserGuardar')?.addEventListener('click', guardarUsuario);
  document.getElementById('btnUserSugerir')?.addEventListener('click', sugerirCredenciales);
  document.getElementById('btnUsersExcel')?.addEventListener('click', exportUsuariosExcel);
  document.getElementById('btnNuevoIntegrante')?.addEventListener('click', crearNuevoIntegrante);
  // Sugerir usuario y contraseña automáticamente al escribir el nombre del nuevo integrante
  document.getElementById('niNombre')?.addEventListener('blur', function() {
    const nombre = this.value.trim();
    const uEl = document.getElementById('niUsuario');
    const pEl = document.getElementById('niPassword');
    if(!nombre || (uEl.value.trim() && pEl.value.trim())) return;
    const cred = generarCredenciales(nombre);
    if(!cred) return;
    if(!uEl.value.trim()) uEl.value = cred.usuario;
    if(!pEl.value.trim()) pEl.value = cred.password;
  });
}

// ─── NUEVO INTEGRANTE: crea supervisor + cuenta en un solo paso ───
async function crearNuevoIntegrante() {
  if(usuarioActual?.rol !== 'admin') { showToast('Solo administradores.', true); return; }
  const nombre = document.getElementById('niNombre').value.trim().toUpperCase();
  let sector = document.getElementById('niSector').value.trim().toUpperCase();
  const usuario = document.getElementById('niUsuario').value.trim().toLowerCase();
  const password = document.getElementById('niPassword').value.trim();

  if(!nombre || !sector || !usuario || !password) { showToast('Completa nombre, sector, usuario y contraseña.', true); return; }
  if(password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', true); return; }
  if(!sector.startsWith('SECTOR')) sector = 'SECTOR ' + sector;
  if(usuariosCuentas.some(c => c.usuario===usuario) || USUARIOS.some(c => c.usuario===usuario)) {
    showToast('⚠️ Ese nombre de usuario ya existe. Elige otro.', true); return;
  }
  if(supervisores.some(s => s.nombre===nombre && s.sector===sector && s.estado==='activo')) {
    showToast('⚠️ Ese supervisor con ese sector ya existe. Créale solo la cuenta arriba.', true); return;
  }
  try {
    // 1) Registrar el supervisor (aparece en todos los selectores)
    await addDoc(collection(db, COL_SUPS), {nombre, sector, estado:'activo', creadoEn:new Date().toISOString()});
    // 2) Crear su cuenta de acceso (solo se guarda la huella cifrada)
    await addDoc(collection(db, COL_USERS), {
      usuario, password_hash: await etiHash(usuario, password), supervisorNombre: nombre,
      estado:'activo', creadoPor: usuarioActual.nombre, creadoEn: new Date().toISOString()
    });
    ['niNombre','niSector','niUsuario','niPassword'].forEach(id => document.getElementById(id).value='');
    showToast(`✅ ${nombre} registrado como supervisor de ${sector}. Usuario: ${usuario} · Contraseña: ${password} — anótala ahora: por seguridad no volverá a mostrarse.`);
  } catch(e) { console.error(e); showToast('❌ Error al crear el nuevo integrante.', true); }
}

// Genera un usuario \u00fanico a partir del nombre (inicial + primer apellido)
function generarCredenciales(nombre) {
  const partes = nombre.trim().toLowerCase().split(/\s+/);
  if(!partes[0]) return null;
  let base = (partes[0][0]||'') + (partes[1]||partes[0]);
  base = base.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  let usuario = base, n = 2;
  const existe = u => usuariosCuentas.some(c => c.usuario===u) || USUARIOS.some(c => c.usuario===u);
  while(existe(usuario)) { usuario = base + n; n++; }
  return { usuario, password: usuario + new Date().getFullYear() };
}

function sugerirCredenciales() {
  const nombre = document.getElementById('uSupervisor').value;
  if(!nombre) { showToast('Primero elige el supervisor.', true); return; }
  const cred = generarCredenciales(nombre);
  if(!cred) return;
  document.getElementById('uUsuario').value = cred.usuario;
  document.getElementById('uPassword').value = cred.password;
}

async function guardarUsuario() {
  if(usuarioActual?.rol !== 'admin') { showToast('Solo administradores.', true); return; }
  const supervisorNombre = document.getElementById('uSupervisor').value;
  const usuario = document.getElementById('uUsuario').value.trim().toLowerCase();
  const password = document.getElementById('uPassword').value.trim();
  if(!supervisorNombre || !usuario || !password) { showToast('Completa supervisor, usuario y contraseña.', true); return; }
  if(password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', true); return; }
  if(usuariosCuentas.some(c => c.usuario===usuario) || USUARIOS.some(c => c.usuario===usuario)) {
    showToast('⚠️ Ese nombre de usuario ya existe. Elige otro.', true); return;
  }
  try {
    await addDoc(collection(db, COL_USERS), {
      usuario, password_hash: await etiHash(usuario, password), supervisorNombre,
      estado:'activo', creadoPor: usuarioActual.nombre, creadoEn: new Date().toISOString()
    });
    document.getElementById('uSupervisor').value='';
    document.getElementById('uUsuario').value='';
    document.getElementById('uPassword').value='';
    showToast(`✅ Cuenta creada para ${supervisorNombre} (usuario: ${usuario} · contraseña: ${password}) — anótala ahora: por seguridad no volverá a mostrarse.`);
  } catch(e) { console.error(e); showToast('❌ Error al crear la cuenta.', true); }
}

function renderListaUsuarios() {
  const div = document.getElementById('listaUsuarios');
  if(!div) return;
  if(!usuariosCuentas.length) { div.innerHTML='<p class="empty-msg">Sin cuentas registradas aún. Crea la primera arriba.</p>'; return; }
  div.innerHTML = usuariosCuentas.map(c => `
    <div class="user-row ${c.estado==='inactivo'?'inactivo':''}">
      <div class="user-row-avatar">${iniciales(c.supervisorNombre)}</div>
      <div class="user-row-info">
        <div class="user-row-nombre">${esc(c.supervisorNombre)} ${c.estado==='inactivo'?'<span style="color:var(--rojo);font-size:10px;font-weight:700;">· INACTIVA</span>':''}</div>
        <div class="user-row-meta">Usuario: <code>${esc(c.usuario)}</code> · Contraseña: <code>🔒 protegida</code></div>
      </div>
      <div style="display:flex;gap:5px;">
        <button class="btn btn-secondary btn-sm" onclick="resetPassUsuario('${c.id}')" title="Cambiar contraseña"><svg class="ico sm"><use href="#i-key"/></svg></button>
        ${c.estado==='inactivo'
          ? `<button class="btn btn-success btn-sm" onclick="toggleUsuario('${c.id}','activo')" title="Reactivar"><svg class="ico sm"><use href="#i-check"/></svg></button>`
          : `<button class="btn btn-danger btn-sm" onclick="toggleUsuario('${c.id}','inactivo')" title="Desactivar acceso"><svg class="ico sm"><use href="#i-lock"/></svg></button>`}
        <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${c.id}')" title="Eliminar cuenta"><svg class="ico sm"><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join('');
}

window.toggleUsuario = async function(id, estado) {
  if(usuarioActual?.rol !== 'admin') return;
  try { await updateDoc(doc(db, COL_USERS, id), {estado}); showToast(estado==='activo'?'✅ Cuenta reactivada':'⛔ Cuenta desactivada — ya no podrá iniciar sesión'); }
  catch(e) { showToast('Error', true); }
};

window.resetPassUsuario = async function(id) {
  if(usuarioActual?.rol !== 'admin') return;
  const c = usuariosCuentas.find(x => x.id===id);
  if(!c) return;
  const nueva = prompt(`Nueva contraseña para ${c.supervisorNombre} (usuario: ${c.usuario}):`, (c.usuario + new Date().getFullYear()));
  if(!nueva || nueva.trim().length < 6) { if(nueva!==null) showToast('Mínimo 6 caracteres.', true); return; }
  try {
    await updateDoc(doc(db, COL_USERS, id), {password_hash: await etiHash(c.usuario, nueva.trim()), password: deleteField()});
    showToast(`🔑 Contraseña actualizada: ${nueva.trim()} — entrégala al supervisor; por seguridad no volverá a mostrarse.`);
  }
  catch(e) { showToast('Error', true); }
};

window.eliminarUsuario = async function(id) {
  if(usuarioActual?.rol !== 'admin') return;
  if(!confirm('¿Eliminar esta cuenta de acceso? El supervisor y su historial se conservan.')) return;
  try { await deleteDoc(doc(db, COL_USERS, id)); showToast('🗑 Cuenta eliminada'); }
  catch(e) { showToast('Error', true); }
};

function exportUsuariosExcel() {
  if(!usuariosCuentas.length) { showToast('Sin cuentas para exportar', true); return; }
  const data = usuariosCuentas.map(c => ({
    'Supervisor': c.supervisorNombre, 'Usuario': c.usuario,
    'Contraseña': '🔒 Protegida (usa "Cambiar contraseña" para asignar una nueva)',
    'Estado': c.estado||'activo', 'Creada': (c.creadoEn||'').substring(0,10)
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Credenciales ETI');
  XLSX.writeFile(wb, `ETI_Credenciales_${formatDate(new Date())}.xlsx`);
  showToast('📥 Credenciales exportadas. Entrégalas de forma segura a cada supervisor.');
}


/* _SOLREPROG_V1 (30-set-2026): usuario supervisor para "Actividad no realizada / pedir reprogramación" (solreprog.js) */
window._etiUsuarioReprog = () => (usuarioActual && usuarioActual.rol === 'supervisor') ? { usuario: usuarioActual.usuario, nombre: usuarioActual.nombre } : null;
