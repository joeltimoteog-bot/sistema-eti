// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  aplicarLinkRRLL();
  document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
  ssoDesdeRRLL();   // ingreso directo si viene con pase del Sistema RR.LL
});

// ── SSO desde el Sistema RR.LL: pase de un solo uso en la dirección ──
// #sso=<pase>.<firma> válido y vigente (90 s) → entra directo sin login.
// El pase se borra de la barra al instante: la URL copiada lleva al login.
async function ssoDesdeRRLL() {
  try {
    const m = location.hash.match(/#sso=([^.]+)\.([a-f0-9]{64})/);
    if (!m) return;
    const m2 = location.hash.match(/[#&]sso2=([A-Za-z0-9_\-\.]+)/);   /* _ETI_PERMISO_V1: pase firmado por el servidor */
    history.replaceState(null, '', location.pathname + location.search);  // borrar el pase
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1] + '|RL-SSO-VERFRUT-2026'));
    const firma = Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
    if (firma !== m[2]) return;                                            // pase adulterado
    const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!d || !d.u || !d.exp || Date.now() > Number(d.exp)) return;        // pase caducado
    const u = String(d.u).toLowerCase();
    let found = USUARIOS.find(x => x.usuario === u);
    if (!found) {
      // ¿Cuenta de supervisor registrada en la nube?
      try {
        const snap = await getDocs(collection(db, COL_USERS));
        const c = snap.docs.map(x => ({ id: x.id, ...x.data() }))
          .find(x => String(x.usuario || '').toLowerCase() === u && x.estado !== 'inactivo');
        if (c) found = { usuario: c.usuario, nombre: c.supervisorNombre, rol: 'supervisor' };
      } catch (e) {}
    }
    /* _SSO_ALTA_V1 (20-set-2026): pase firmado y vigente pero usuario sin ficha aqui.
       Antes se quedaba en el login (y su clave del RR.LL no sirve en este sistema).
       Ahora entra como supervisor con el nombre que trae el pase. */
    if (!found && d.n) found = { usuario: u, nombre: String(d.n), rol: 'supervisor', alta_sso: true };
    /* _ETI_PERMISO_V1 (14-oct-2026): si el administrador le dio "Capacitaciones ETI (programar)"
       en Acceso a Modulos del Sistema RR.LL, entra con el rol del EQUIPO ('usuario'): programar,
       reprogramar, registrar y ver estadisticas. Lo exclusivo del administrador (usuarios, borrar
       registros, eliminar supervisores) sigue solo para el admin. El permiso lo confirma el
       SERVIDOR (pase sso2 firmado en Azure); si no responde, entra como siempre. */
    try {
      if (m2 && found && found.rol === 'supervisor') {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch('https://rl-fn-verfrut.azurewebsites.net/api/auth/sso',
          { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'verificar', pase: m2[1] }) });
        clearTimeout(t);
        const j = await r.json();
        if (j && j.success && j.user && String(j.user.usuario || '').toLowerCase() === u && j.user.etiProg === true) {
          found = { usuario: u, nombre: found.nombre || String(d.n || u), rol: 'usuario', permisoRRLL: true };
          console.log('[_ETI_PERMISO_V1] ' + u + ' entra con permiso de programar (Acceso a Modulos)');
        }
      }
    } catch (eP) { console.warn('[_ETI_PERMISO_V1] no se pudo confirmar el permiso:', eP && eP.message); }
    if (found) entrarConUsuario(found);
    else console.warn('[SSO] pase valido pero sin usuario registrado:', u);
  } catch (e) {}
}

// ─── LOGIN ────────────────────────────────────────────────────
function initLogin() {
  document.getElementById('btnLogin').addEventListener('click', intentarLogin);
  document.getElementById('loginPass').addEventListener('keypress', e => { if(e.key==='Enter') intentarLogin(); });
  document.getElementById('loginUser').addEventListener('keypress', e => { if(e.key==='Enter') document.getElementById('loginPass').focus(); });
}

async function intentarLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const errDiv = document.getElementById('loginError');
  /* _LOGIN_COMUN_V1 (18-oct): la contraseña es la MISMA del Sistema RR.LL. Se valida igual que allá
     (Azure y, si Azure no responde, Google). Las listas locales solo quedan como último recurso
     cuando ningún servidor responde. */
  const errTxt = (m) => { errDiv.innerHTML = '<svg class="ico sm"><use href="#i-alert"/></svg> ' + String(m).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); errDiv.style.display = 'flex'; };
  if (!user || !pass) { errTxt('Ingresa tu usuario y contraseña.'); return; }
  const btnL = document.getElementById('btnLogin'); const txtL = btnL ? btnL.innerHTML : '';
  let rc = null;
  if (window.rlLoginComun) {
    if (btnL) { btnL.disabled = true; btnL.textContent = 'Verificando…'; }
    try { rc = await window.rlLoginComun(user, pass); } catch (e) { rc = null; }
    if (btnL) { btnL.disabled = false; btnL.innerHTML = txtL; }
  }
  if (rc && rc.ok) {
    const su = rc.user || {}, uu = String(su.usuario || user).toLowerCase().trim();
    const loc = USUARIOS.find(x => x.usuario === uu);
    const fnd = { usuario: uu, nombre: (loc && loc.nombre) || su.nombre || uu, rol: (loc && loc.rol === 'admin') ? 'admin' : 'supervisor' };
    errDiv.style.display = 'none';
    if (fnd.rol !== 'admin') { mostrarAvisoIngresoRRLL(); return; }
    entrarConUsuario(fnd);
    return;
  }
  if (rc && !rc.sinServidor) {
    errTxt(rc.bloqueado ? (rc.error || 'Usuario bloqueado temporalmente. Comunícate con el administrador del sistema, Joel Timoteo.')
      : 'Usuario o contraseña incorrectos (es la misma del Sistema RR.LL.).' + (typeof rc.intentosRestantes === 'number' && rc.intentosRestantes > 0 ? ' Te quedan ' + rc.intentosRestantes + ' intento(s).' : ''));
    document.getElementById('loginPass').value = '';
    return;
  }
  let hash = '';
  try { hash = await etiHash(user, pass); } catch(e) { console.error('hash', e); }
  let found = USUARIOS.find(u => u.usuario===user && u.ph===hash);

  // Cuentas de supervisores registradas en la nube.
  // Se comparan por huella cifrada; las cuentas antiguas (contraseña en texto
  // plano) siguen entrando y se migran solas a huella en ese momento.
  if(!found && user && pass) {
    try {
      const snap = await getDocs(collection(db, COL_USERS));
      const cuentas = snap.docs.map(d => ({id:d.id, ...d.data()}));
      const c = cuentas.find(u => (u.usuario||'').toLowerCase()===user && u.estado!=='inactivo' &&
        ((u.password_hash && u.password_hash===hash) || (u.password && u.password===pass)));
      if(c) {
        found = { usuario:c.usuario, nombre:c.supervisorNombre, rol:'supervisor' };
        if(!c.password_hash && hash) {
          try { await _fsUpdateDoc(doc(db, COL_USERS, c.id), {password_hash: hash, password: deleteField()}); }
          catch(eM) { console.warn('No se pudo migrar la cuenta a huella cifrada:', eM); }
        }
      }
    } catch(e) { console.error('Error consultando cuentas:', e); }
  }

  if(!found) { errTxt(rc && rc.sinServidor ? rc.error : 'Usuario o contraseña incorrectos'); return; }
  errDiv.style.display='none';
  // 🔐 Supervisores y equipo ya NO entran por este login: su puerta es el
  // Sistema RR.LL (tarjeta con pase SSO). Solo administradores conservan
  // el login manual como respaldo.
  if (found.rol !== 'admin') { mostrarAvisoIngresoRRLL(); return; }
  entrarConUsuario(found);
}

function mostrarAvisoIngresoRRLL() {
  let ov = document.getElementById('avisoSSO');
  if (ov) { ov.style.display = 'flex'; return; }
  ov = document.createElement('div');
  ov.id = 'avisoSSO';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,40,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:420px;text-align:center;padding:30px 26px;box-shadow:0 20px 60px rgba(0,0,0,.45)">' +
    '<div style="font-size:44px">🔐</div>' +
    '<div style="font-size:17px;font-weight:800;color:#0a2463;margin-top:8px">El ingreso ahora es desde el Sistema RR.LL</div>' +
    '<div style="font-size:13.5px;color:#475569;margin-top:10px;line-height:1.55">Por seguridad, entra al <b>Sistema de Relaciones Laborales</b> con tu usuario y contraseña de siempre, y haz clic en la tarjeta del <b>Sistema ETI</b>: entrarás directo, sin volver a escribir tu clave.</div>' +
    '<button onclick="window.location.href=\'' + (URL_SISTEMA_RRLL || 'https://joeltimoteog-bot.github.io/sistema-rl-verfrut/index.html') + '\'" style="margin-top:18px;background:#0a2463;color:#fff;border:none;border-radius:10px;padding:12px 24px;font-weight:800;font-size:14px;cursor:pointer">🏢 Ir al Sistema RR.LL</button>' +
    '<div style="margin-top:10px;font-size:12px;color:#94a3b8;cursor:pointer" onclick="document.getElementById(\'avisoSSO\').remove()">cerrar</div></div>';
  document.body.appendChild(ov);
}

// Arranque de sesión (lo usa el login normal y el ingreso directo SSO desde RR.LL)
function entrarConUsuario(found) {
  usuarioActual = found;
  resumenMostrado = false;
  avisoSupMostrado = false;
  dataRegsCargada = false;
  dataProgCargada = false;
  document.getElementById('loginPage').style.display='none';
  document.getElementById('appPage').style.display='block';
  pintarUsuarioUI(found);
  const btnClear=document.getElementById('btnClearAll');
  if(btnClear) btnClear.style.display=found.rol==='admin'?'inline-flex':'none';
  actualizarHeaderFecha();
  if(!uiInicializada) {
    initTabs();
    initForm();
    initFiltros();
    initBotones();
    initProgramacion();
    initNotificaciones();
    initPanelSupervisor();
    initUsuariosAdmin();
    uiInicializada = true;
  }
  aplicarRol();
  escucharFirebase();
  escucharSupervisores();
  escucharProgramaciones();
  escucharUsuarios();
  rlPresenciaIniciar();   // presencia + chat (canal compartido con Sistema RR.LL)
  if(found.rol==='admin') migrarCuentasAHuella();
}

// ── MIGRACIÓN DE SEGURIDAD (una sola vez, silenciosa) ──
// Cuando entra el administrador, toda cuenta antigua con contraseña en texto
// plano se convierte a huella cifrada y el texto plano se elimina de la nube.
let _migracionHecha = false;
async function migrarCuentasAHuella() {
  if(_migracionHecha) return;
  _migracionHecha = true;
  try {
    const snap = await getDocs(collection(db, COL_USERS));
    let n = 0;
    for(const d of snap.docs) {
      const c = d.data();
      if(c.password && !c.password_hash && c.usuario) {
        try {
          await _fsUpdateDoc(doc(db, COL_USERS, d.id),
            {password_hash: await etiHash(String(c.usuario).toLowerCase(), c.password), password: deleteField()});
          n++;
        } catch(e) { console.warn('migración', c.usuario, e); }
      }
    }
    if(n) showToast(`🔐 Seguridad: ${n} cuenta(s) migrada(s) a contraseña cifrada.`);
  } catch(e) { console.warn('migración de cuentas:', e); }
}

function iniciales(nombre) {
  return (nombre||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '–';
}

const ROL_LABEL = { admin:'Administrador', usuario:'Equipo RRLL', supervisor:'Supervisor' };

function pintarUsuarioUI(u) {
  const ini = iniciales(u.nombre);
  setText('sfAvatar', ini);
  setText('chipAvatar', ini);
  setText('sfNombre', u.nombre);
  setText('sfRol', ROL_LABEL[u.rol]||u.rol);
  setText('userBadge', u.nombre.split(' ').slice(0,2).join(' '));
  aplicarLinkRRLL();
}

// Muestra los botones "Sistema RR.LL" solo si hay URL configurada
function aplicarLinkRRLL() {
  ['linkRRLL','linkRRLLLogin','linkRRLLTop'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    if(URL_SISTEMA_RRLL) {
      el.href = URL_SISTEMA_RRLL;
      el.target = '_self';   // volver al Sistema RR.LL en la MISMA pestaña (sin abrir otra página)
      el.style.display = 'inline-flex';
    }
    else el.style.display = 'none';
  });
}

// Muestra u oculta la navegación según el rol del usuario
function aplicarRol() {
  const rol = usuarioActual?.rol || 'usuario';
  document.querySelectorAll('#sideNav [data-role]').forEach(el => {
    const r = el.dataset.role;
    const visible = rol==='supervisor' ? r==='supervisor'
      : (r==='staff' || (r==='admin' && rol==='admin'));
    el.style.display = visible ? '' : 'none';
  });
  const inicial = rol==='supervisor' ? 'mipanel' : 'dashboard';
  const btn = document.querySelector(`.tab-btn[data-tab="${inicial}"]`);
  if(btn) btn.click();
  if(rol==='supervisor') setText('supHeroNombre', 'Hola, '+usuarioActual.nombre.split(' ').slice(0,2).join(' '));
}

function cerrarSesion() {
  rlPresenciaDetener();   // marcar fuera de línea y apagar chat
  if(unsubscribe) { unsubscribe(); unsubscribe=null; }
  if(unsubSups) { unsubSups(); unsubSups=null; }
  if(unsubProg) { unsubProg(); unsubProg=null; }
  if(unsubUsers) { unsubUsers(); unsubUsers=null; }
  usuarioActual=null;
  document.getElementById('appPage').style.display='none';
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
}
