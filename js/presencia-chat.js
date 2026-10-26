/* Sistema ETI Capacitaciones · presencia + mensajeria (canal compartido con RR.LL.)
   Extraido de script.js el 25-oct-2026 (_ETI_MODULAR_V1) SIN cambios de logica: solo se lee el estado
   compartido a traves de C (usuarioActual, supervisores, usuariosCuentas, esc, showToast, cerrarSesion). */
export function instalarPresenciaChat(C) {
// ════════════════════════════════════════════════
//  PRESENCIA + MENSAJERÍA — canal compartido con el Sistema RR.LL
//  Rutas /presencia y /mensajes del RTDB sistema-rl-verfrut (las mismas que
//  usan presencia.js, el Monitor RR.LL y el sistema de Evaluaciones ETI).
//  Modo REST: funciona en cualquier red, sin dependencias nuevas.
// ════════════════════════════════════════════════
const RL_DB_URL = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
const RL_ADMINS = ['jtimoteo'];
const RL_MODULO = 'Sistema ETI · Capacitaciones';

let rlTimers = [];
let rlMsgs = [], rlChatAbierto = false, rlChatCon = null;
let rlNotif = new Set(), rlPrimeraCarga = true;
let rlPresOnline = [], rlPresPrev = null;

const rlUkey = u => String(u).toLowerCase().replace(/[.#$/\[\]]/g, '_');
const rlSoyAdmin = () => !!C.usuarioActual && RL_ADMINS.includes(String(C.usuarioActual.usuario).toLowerCase());
const rlEsParaMi = m => !!C.usuarioActual && (rlSoyAdmin() ? m.de === 'user' : m.de === 'admin');
const rlEnLinea = p => p.online && (Date.now() - Number(p.ultimo_ping || 0)) < 130000;
const rlSistemaDe = p =>
  p.modulo === 'Evaluaciones ETI' ? 'Sistema de Evaluaciones ETI'
  : p.modulo === RL_MODULO ? RL_MODULO
  : 'Sistema RR.LL' + (p.modulo ? ' · ' + p.modulo : '');

// ── Presencia ──
function rlPresPayload(online) {
  return { usuario: C.usuarioActual.usuario, nombre: C.usuarioActual.nombre || C.usuarioActual.usuario,
           rol: C.usuarioActual.rol || '', empresa: '', modulo: RL_MODULO, pagina: 'sistema-eti',
           online: !!online, ultimo_ping: { '.sv': 'timestamp' } };
}
function rlMarcarPresencia(online) {
  if (!C.usuarioActual) return;
  try {
    fetch(RL_DB_URL + '/presencia/' + rlUkey(C.usuarioActual.usuario) + '.json', {
      method: 'PUT', body: JSON.stringify(rlPresPayload(online))
    }).catch(() => {});
  } catch (e) {}
}
window.addEventListener('beforeunload', () => {
  if (!C.usuarioActual) return;
  try {
    fetch(RL_DB_URL + '/presencia/' + rlUkey(C.usuarioActual.usuario) + '.json', {
      method: 'PATCH', body: JSON.stringify({ online: false }), keepalive: true
    }).catch(() => {});
  } catch (e) {}
});
document.addEventListener('visibilitychange', () => { if (C.usuarioActual) rlMarcarPresencia(!document.hidden); });

function rlPresenciaIniciar() {
  if (!C.usuarioActual) return;
  rlTimers.forEach(t => clearInterval(t)); rlTimers = [];
  rlPrimeraCarga = true; rlNotif = new Set(); rlPresPrev = null;
  rlMarcarPresencia(!document.hidden);
  rlTimers.push(setInterval(() => { if (C.usuarioActual) rlMarcarPresencia(!document.hidden); }, 20000));
  // Historial de conexiones: 1 registro por sesión de navegador
  try {
    if (!sessionStorage.getItem('_eti6_hist_ok')) {
      sessionStorage.setItem('_eti6_hist_ok', '1');
      fetch(RL_DB_URL + '/historial/' + rlUkey(C.usuarioActual.usuario) + '.json', {
        method: 'POST',
        body: JSON.stringify({ ts: { '.sv': 'timestamp' }, evento: 'ingreso', pagina: 'sistema-eti', modulo: RL_MODULO })
      }).catch(() => {});
    }
  } catch (e) {}
  // Chat
  rlCrearChatUI();
  document.getElementById('rlChatFab').style.display = 'flex';
  const pathMsg = rlSoyAdmin() ? 'mensajes' : 'mensajes/' + rlUkey(C.usuarioActual.usuario);
  const tickMsg = () => {
    try {
      fetch(RL_DB_URL + '/' + pathMsg + '.json?nc=' + Date.now())
        .then(r => r.json()).then(rlProcMsgs).catch(() => {});
    } catch (e) {}
  };
  tickMsg(); rlTimers.push(setInterval(tickMsg, 12000));
  // Solo admin: vigilar presencia (avisos de ingreso a cualquiera de los sistemas)
  if (rlSoyAdmin()) {
    const tickPres = () => {
      try {
        fetch(RL_DB_URL + '/presencia.json?nc=' + Date.now())
          .then(r => r.json()).then(rlProcPresencia).catch(() => {});
      } catch (e) {}
    };
    tickPres(); rlTimers.push(setInterval(tickPres, 20000));
  }
}
function rlPresenciaDetener() {
  rlTimers.forEach(t => clearInterval(t)); rlTimers = [];
  if (C.usuarioActual) {
    try {
      fetch(RL_DB_URL + '/presencia/' + rlUkey(C.usuarioActual.usuario) + '.json', {
        method: 'PATCH', body: JSON.stringify({ online: false }), keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }
  rlMsgs = []; rlChatAbierto = false; rlChatCon = null;
  rlNotif = new Set(); rlPrimeraCarga = true;
  rlPresOnline = []; rlPresPrev = null;
  const f = document.getElementById('rlChatFab'); if (f) f.style.display = 'none';
  const p = document.getElementById('rlChatPanel'); if (p) p.style.display = 'none';
}

// ── Presencia: procesamiento (solo admin) ──
function rlProcPresencia(val) {
  if (!C.usuarioActual) return;
  const yo = rlUkey(C.usuarioActual.usuario);
  const arr = Object.keys(val || {}).map(k => ({ k, ...(val[k] || {}) }));
  rlPresOnline = arr.filter(p => p.k !== yo && rlEnLinea(p));
  const keys = new Set(rlPresOnline.map(p => p.k));
  if (rlPresPrev === null) {
    if (rlPresOnline.length)
      C.showToast(`🟢 En línea ahora: ${rlPresOnline.map(p => String(p.nombre || p.usuario || p.k).split(' ')[0]).join(', ')}`);
  } else {
    rlPresOnline.forEach(p => {
      if (!rlPresPrev.has(p.k))
        C.showToast(`🟢 ${C.esc(p.nombre || p.usuario || p.k)} ingresó — ${C.esc(rlSistemaDe(p))}`);
    });
  }
  rlPresPrev = keys;
  if (rlChatAbierto && rlSoyAdmin() && !rlChatCon) rlRenderChat();
}

// ── Mensajes: normalizar y procesar ──
function rlNormalizar(val, soloUser) {
  const out = [];
  const porConv = soloUser ? { [soloUser]: (val || {}) } : (val || {});
  Object.keys(porConv).forEach(k => {
    const conv = porConv[k] || {};
    Object.keys(conv).forEach(id => {
      const m = conv[id] || {};
      if (!m || typeof m !== 'object') return;
      const deAdmin = RL_ADMINS.includes(String(m.de_usuario || '').toLowerCase());
      out.push({ id: k + '/' + id, user: k, de: deAdmin ? 'admin' : 'user',
                 deUser: m.de_usuario || '', deNom: m.de || '', texto: m.texto || '',
                 ts: Number(m.ts || 0), leido: !!m.leido });
    });
  });
  return out.sort((a, b) => a.ts - b.ts);
}
function rlProcMsgs(val) {
  if (!C.usuarioActual) return;
  rlMsgs = rlNormalizar(val, rlSoyAdmin() ? null : rlUkey(C.usuarioActual.usuario));
  const noLeidos = rlMsgs.filter(m => rlEsParaMi(m) && !m.leido);
  if (rlPrimeraCarga) {
    noLeidos.forEach(m => rlNotif.add(m.id));
    if (noLeidos.length) C.showToast(`💬 Tienes ${noLeidos.length} mensaje(s) sin leer`);
    rlPrimeraCarga = false;
  } else {
    noLeidos.forEach(m => {
      if (!rlNotif.has(m.id)) {
        rlNotif.add(m.id);
        C.showToast(`💬 ${C.esc(m.deNom || m.deUser || 'Mensaje')}: "${C.esc((m.texto || '').slice(0, 70))}"`);
      }
    });
  }
  rlBadge();
  if (rlChatAbierto) { rlRenderChat(); rlMarcarLeidos(); }
}
function rlBadge() {
  const b = document.getElementById('rlChatBadge');
  if (!b) return;
  const n = rlMsgs.filter(m => rlEsParaMi(m) && !m.leido).length;
  b.textContent = n > 99 ? '99+' : n;
  b.style.display = n ? '' : 'none';
}
function rlMarcarLeidos() {
  if (!C.usuarioActual || !rlChatAbierto) return;
  rlMsgs
    .filter(m => rlEsParaMi(m) && !m.leido && (!rlSoyAdmin() || m.user === rlChatCon))
    .forEach(m => {
      m.leido = true;
      try {
        fetch(RL_DB_URL + '/mensajes/' + m.id + '.json', {
          method: 'PATCH', body: JSON.stringify({ leido: true, leido_ts: { '.sv': 'timestamp' } })
        }).catch(() => {});
      } catch (e) {}
    });
  rlBadge();
}
function rlNombreDe(key) {
  const u = C.USUARIOS.find(x => rlUkey(x.usuario) === key);
  if (u) return u.nombre;
  const c = (C.usuariosCuentas || []).find(x => rlUkey(x.usuario || '') === key);
  if (c) return c.supervisorNombre || c.usuario;
  const p = rlPresOnline.find(p => p.k === key);
  if (p && (p.nombre || p.usuario)) return p.nombre || p.usuario;
  const m = [...rlMsgs].reverse().find(m => m.user === key && m.de === 'user' && m.deNom);
  return (m && m.deNom) || key;
}

// ── UI del chat ──
function rlToggleChat() {
  const p = document.getElementById('rlChatPanel');
  if (!p) return;
  rlChatAbierto = p.style.display !== 'flex';
  p.style.display = rlChatAbierto ? 'flex' : 'none';
  if (rlChatAbierto) {
    if (!rlSoyAdmin()) rlChatCon = rlUkey(C.usuarioActual.usuario);
    rlRenderChat(); rlMarcarLeidos();
  }
}
function rlAbrirChat(key) {
  rlChatCon = key;
  const p = document.getElementById('rlChatPanel');
  if (p && p.style.display !== 'flex') { p.style.display = 'flex'; rlChatAbierto = true; }
  rlRenderChat(); rlMarcarLeidos();
}
function rlHora(ts) {
  if (!ts) return '';
  const d = new Date(ts), hoy = new Date();
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === hoy.toDateString() ? hora : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' ' + hora;
}
function rlRenderChat() {
  const body = document.getElementById('rlChatBody');
  const title = document.getElementById('rlChatTitle');
  const back = document.getElementById('rlChatBack');
  const inputrow = document.getElementById('rlChatInputRow');
  if (!body) return;
  const esAdmin = rlSoyAdmin();

  if (esAdmin && !rlChatCon) {
    back.style.display = 'none';
    inputrow.style.display = 'none';
    title.textContent = '💬 Mensajes por usuario';
    const porUser = {};
    rlMsgs.forEach(m => { if (m.user) (porUser[m.user] = porUser[m.user] || []).push(m); });
    C.USUARIOS.filter(u => u.rol !== 'admin').forEach(u => { const k = rlUkey(u.usuario); porUser[k] = porUser[k] || []; });
    (C.usuariosCuentas || []).forEach(c => { if (c.usuario) { const k = rlUkey(c.usuario); porUser[k] = porUser[k] || []; } });
    rlPresOnline.forEach(p => { porUser[p.k] = porUser[p.k] || []; });
    const items = Object.keys(porUser).map(u => {
      const ms = porUser[u], ult = ms[ms.length - 1];
      const noLe = ms.filter(m => m.de === 'user' && !m.leido).length;
      const online = rlPresOnline.some(p => p.k === u);
      return { u, ult, noLe, online, ts: ult ? ult.ts : 0 };
    }).sort((a, b) => (b.noLe - a.noLe) || (b.ts - a.ts) || ((b.online ? 1 : 0) - (a.online ? 1 : 0)));
    body.innerHTML = items.map(it => `
      <div class="rl-conv" data-rluser="${C.esc(it.u)}">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:.8rem;">${it.online ? '🟢 ' : ''}${C.esc(rlNombreDe(it.u))}</div>
          <div style="font-size:.7rem;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${it.ult ? C.esc((it.ult.de === 'admin' ? 'Tú: ' : '') + it.ult.texto) : 'Sin mensajes'}</div>
        </div>
        ${it.noLe ? `<span style="background:#C8102E;color:#fff;border-radius:999px;font-size:.65rem;font-weight:800;padding:.15rem .45rem;">${it.noLe}</span>` : ''}
      </div>`).join('') || '<div style="opacity:.7;font-size:.8rem;padding:1rem;">Sin conversaciones.</div>';
    return;
  }

  const conv = rlMsgs.filter(m => m.user === rlChatCon);
  back.style.display = esAdmin ? '' : 'none';
  inputrow.style.display = 'flex';
  title.textContent = esAdmin ? '💬 ' + rlNombreDe(rlChatCon) : '💬 Coordinación RR.LL (Joel Timoteo)';
  body.innerHTML = conv.length ? conv.map(m => {
    const mio = esAdmin ? m.de === 'admin' : m.de === 'user';
    return `<div class="rl-msg ${mio ? 'rl-mio' : 'rl-otro'}">
      ${C.esc(m.texto)}
      <div class="rl-meta">${C.esc(mio ? 'Tú' : (m.deNom || m.deUser || ''))} · ${rlHora(m.ts)}</div>
    </div>`;
  }).join('') : '<div style="opacity:.7;font-size:.8rem;padding:1rem;text-align:center;">Aún no hay mensajes.<br>Escribe el primero 👇</div>';
  body.scrollTop = body.scrollHeight;
}
function rlEnviarMsg() {
  const inp = document.getElementById('rlChatInput');
  const texto = (inp.value || '').trim();
  if (!texto || !C.usuarioActual) return;
  const destino = rlSoyAdmin() ? rlChatCon : rlUkey(C.usuarioActual.usuario);
  if (!destino) { C.showToast('Selecciona un usuario primero', true); return; }
  try {
    fetch(RL_DB_URL + '/mensajes/' + destino + '.json', {
      method: 'POST',
      body: JSON.stringify({ texto: texto.slice(0, 990), de: C.usuarioActual.nombre || C.usuarioActual.usuario,
                             de_usuario: C.usuarioActual.usuario, ts: { '.sv': 'timestamp' }, leido: false })
    }).then(r => { if (!r || !r.ok) throw new Error('REST'); })
      .catch(e => { console.error('Chat:', e); C.showToast('No se pudo enviar el mensaje', true); });
  } catch (e) { C.showToast('No se pudo enviar el mensaje', true); return; }
  rlMsgs.push({ id: 'local_' + Math.random().toString(36).slice(2), user: destino,
                de: rlSoyAdmin() ? 'admin' : 'user', deUser: C.usuarioActual.usuario,
                deNom: C.usuarioActual.nombre, texto, ts: Date.now(), leido: false });
  inp.value = '';
  rlRenderChat();
}
function rlCrearChatUI() {
  if (document.getElementById('rlChatFab')) return;
  const st = document.createElement('style');
  st.textContent = `
    #rlChatFab{position:fixed;bottom:18px;right:18px;z-index:9000;width:56px;height:56px;border-radius:50%;border:none;background:#003DA5;color:#fff;font-size:1.45rem;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.3);display:none;align-items:center;justify-content:center;}
    #rlChatFab:hover{background:#0050C8;}
    #rlChatBadge{position:absolute;top:-4px;right:-4px;background:#C8102E;color:#fff;border-radius:999px;font-size:.66rem;font-weight:800;padding:.15rem .4rem;min-width:20px;display:none;}
    #rlChatPanel{position:fixed;bottom:84px;right:18px;z-index:9001;width:335px;max-width:calc(100vw - 24px);height:450px;max-height:calc(100vh - 110px);background:#fff;border:1px solid #C0CEEA;border-radius:14px;box-shadow:0 12px 48px rgba(0,61,165,.25);display:none;flex-direction:column;overflow:hidden;color:#1A2340;}
    .rl-chat-head{background:#003DA5;color:#fff;padding:.6rem .8rem;display:flex;align-items:center;gap:.5rem;font-weight:700;font-size:.85rem;}
    .rl-chat-head button{background:none;border:none;color:#fff;font-size:1rem;cursor:pointer;padding:0 .2rem;}
    #rlChatTitle{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #rlChatBody{flex:1;overflow-y:auto;padding:.7rem;background:#F5F7FA;display:flex;flex-direction:column;}
    #rlChatInputRow{display:flex;gap:.4rem;padding:.55rem;border-top:1px solid #C0CEEA;background:#fff;}
    #rlChatInput{flex:1;border:1px solid #C0CEEA;border-radius:8px;padding:.45rem .6rem;font-size:.82rem;font-family:inherit;outline:none;color:#1A2340;}
    #rlChatInput:focus{border-color:#003DA5;}
    #rlChatSend{background:#003DA5;color:#fff;border:none;border-radius:8px;padding:.45rem .8rem;font-size:.8rem;font-weight:700;cursor:pointer;}
    .rl-msg{max-width:82%;margin-bottom:.45rem;padding:.45rem .6rem;border-radius:10px;font-size:.8rem;line-height:1.35;white-space:pre-wrap;word-break:break-word;}
    .rl-mio{align-self:flex-end;background:#003DA5;color:#fff;border-bottom-right-radius:3px;}
    .rl-otro{align-self:flex-start;background:#fff;color:#1A2340;border:1px solid #C0CEEA;border-bottom-left-radius:3px;}
    .rl-meta{font-size:.6rem;opacity:.65;margin-top:.2rem;}
    .rl-conv{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.55rem .6rem;border:1px solid #C0CEEA;border-radius:10px;margin-bottom:.45rem;background:#fff;cursor:pointer;}
    .rl-conv:hover{border-color:#003DA5;}`;
  document.head.appendChild(st);

  const fab = document.createElement('button');
  fab.id = 'rlChatFab'; fab.type = 'button'; fab.title = 'Mensajes';
  fab.innerHTML = '💬<span id="rlChatBadge">0</span>';
  fab.addEventListener('click', rlToggleChat);
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'rlChatPanel';
  panel.innerHTML = `
    <div class="rl-chat-head">
      <button id="rlChatBack" type="button" style="display:none;" title="Volver">←</button>
      <div id="rlChatTitle">Mensajes</div>
      <button id="rlChatClose" type="button" title="Cerrar">✕</button>
    </div>
    <div id="rlChatBody"></div>
    <div id="rlChatInputRow" style="display:none;">
      <input id="rlChatInput" placeholder="Escribe un mensaje..." maxlength="500">
      <button id="rlChatSend" type="button">Enviar</button>
    </div>`;
  document.body.appendChild(panel);

  panel.querySelector('#rlChatBack').addEventListener('click', () => { rlChatCon = null; rlRenderChat(); });
  panel.querySelector('#rlChatClose').addEventListener('click', rlToggleChat);
  panel.querySelector('#rlChatSend').addEventListener('click', rlEnviarMsg);
  panel.querySelector('#rlChatInput').addEventListener('keydown', e => { if (e.key === 'Enter') rlEnviarMsg(); });
  panel.querySelector('#rlChatBody').addEventListener('click', e => {
    const conv = e.target.closest('[data-rluser]');
    if (conv) rlAbrirChat(conv.dataset.rluser);
  });
}

  return { rlPresenciaIniciar, rlPresenciaDetener };
}
