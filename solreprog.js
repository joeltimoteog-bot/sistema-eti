/* ═══════════════════════════════════════════════════════════════════════════
   _SOLREPROG_V1 (30-set-2026) — ACTIVIDAD NO REALIZADA: informar el motivo y
   pedir reprogramacion (Capacitaciones ETI / Evaluaciones ETI, mismo archivo).
   · El supervisor ve sus programaciones con fechas VENCIDAS sin ejecutar, elige
     una, indica el motivo y el detalle -> queda guardado en la misma programacion
     (Firestore, campo solicitudesReprog) con fecha, hora y usuario.
   · El Coordinador recibe la alerta (modulo KPIs RR.LL.) y asigna la nueva fecha
     con "Reprogramar"; al hacerlo la solicitud queda ATENDIDA y los KPIs cuentan
     la nueva fecha. Mientras no se reprograme, la fecha sigue como no ejecutada.
   Necesita window._etiUsuarioReprog() -> { usuario, nombre } del supervisor (o null).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._solReprogOk) return; window._solReprogOk = true;
  var FS = 'https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/';
  var KEY = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
  var MOTIVOS = ['Lluvia / condiciones climáticas', 'Labores del fundo o campaña (indicación del administrador)', 'Personal no disponible / sin convocatoria',
    'Descanso médico, vacaciones o ausencia', 'Falta de materiales o movilidad', 'Otro'];
  var LISTA = [], CUENTA = null;

  function U() { try { return window._etiUsuarioReprog ? window._etiUsuarioReprog() : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dm(f) { return f ? f.slice(8, 10) + '/' + f.slice(5, 7) : ''; }
  function val(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return +v.integerValue; if ('booleanValue' in v) return v.booleanValue;
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(val);
    if ('mapValue' in v) { var o = {}, f = (v.mapValue && v.mapValue.fields) || {}; Object.keys(f).forEach(function (k) { o[k] = val(f[k]); }); return o; }
    return null;
  }
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    if (typeof v === 'object') { var f = {}; Object.keys(v).forEach(function (k) { f[k] = enc(v[k]); }); return { mapValue: { fields: f } }; }
    if (typeof v === 'number') return { integerValue: String(v) };
    if (typeof v === 'boolean') return { booleanValue: v };
    return { stringValue: String(v) };
  }
  async function todos(col) {
    var out = [], tok = '';
    do {
      var r = await fetch(FS + col + '?pageSize=300&key=' + KEY + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
      if (!r.ok) throw new Error('No se pudo leer ' + col + ' (' + r.status + ')');
      var j = await r.json();
      (j.documents || []).forEach(function (d) { var o = { _id: d.name.split('/').pop(), _col: col }; var f = d.fields || {}; Object.keys(f).forEach(function (k) { o[k] = val(f[k]); }); out.push(o); });
      tok = j.nextPageToken || '';
    } while (tok);
    return out;
  }

  /* programaciones del usuario con fechas vencidas sin ejecutar */
  async function cargar() {
    var u = U(); if (!u) return [];
    var res = await Promise.all([todos('usuarios_eti').catch(function () { return []; }), todos('programaciones_eti'), todos('programaciones_eval').catch(function () { return []; })]);
    CUENTA = res[0].filter(function (c) { return String(c.usuario || '').toLowerCase() === String(u.usuario || '').toLowerCase() && c.estado !== 'inactivo'; })[0] || null;
    var miNombre = norm(CUENTA ? CUENTA.supervisorNombre : u.nombre), h = hoy();
    var out = [];
    res[1].concat(res[2]).forEach(function (p) {
      if (norm(p.supervisor || p.sup) !== miNombre || p.estado === 'ejecutada') return;
      var ejec = p.fechasEjecutadas || [];
      var venc = (p.fechas || []).filter(function (f) { return f < h && ejec.indexOf(f) < 0; }).sort();
      if (!venc.length) return;
      var pend = (p.solicitudesReprog || []).filter(function (s) { return String(s.estado).toUpperCase() === 'PENDIENTE'; });
      var yaPedidas = {}; pend.forEach(function (s) { (s.fechas || []).forEach(function (f) { yaPedidas[f] = 1; }); });
      out.push({ id: p._id, col: p._col, tema: p.tema || 'EVALUACIONES DE CHECKLIST', sector: p.sector || '', vencidas: venc,
        sinPedir: venc.filter(function (f) { return !yaPedidas[f]; }), pendiente: pend[pend.length - 1] || null });
    });
    return out;
  }

  function css() {
    if (document.getElementById('_srCss')) return;
    var st = document.createElement('style'); st.id = '_srCss';
    st.textContent = '#_srBtn{position:fixed;right:18px;bottom:18px;z-index:2147481000;background:#dc2626;color:#fff;border:none;border-radius:999px;padding:11px 16px;font:800 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}' +
      '#_srM{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:2147482500;display:flex;align-items:center;justify-content:center;padding:14px;font-family:system-ui,sans-serif}' +
      '#_srM .bx{background:#fff;color:#0f172a;border-radius:14px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:18px}' +
      '#_srM h3{margin:0 0 6px;color:#0a2463;font-size:17px}#_srM label{display:block;font-weight:700;font-size:12.5px;margin:12px 0 4px}' +
      '#_srM select,#_srM textarea{width:100%;box-sizing:border-box;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;font:14px system-ui,sans-serif}' +
      '#_srM .it{border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin-top:8px;cursor:pointer;font-size:13px}#_srM .it.on{border-color:#0a2463;background:#eff6ff}' +
      '#_srM .it.no{opacity:.6;cursor:default}#_srM .bt{border:none;border-radius:8px;padding:9px 14px;font-weight:800;cursor:pointer}#_srM .sub{font-size:12px;color:#64748b}';
    document.head.appendChild(st);
  }

  async function refrescarBoton() {
    var u = U(), b = document.getElementById('_srBtn');
    if (!u) { if (b) b.remove(); return; }
    try { LISTA = await cargar(); } catch (e) { return; }
    var n = LISTA.filter(function (x) { return x.sinPedir.length; }).length;
    if (!n) { if (b) b.remove(); return; }
    css();
    if (!b) { b = document.createElement('button'); b.id = '_srBtn'; b.type = 'button'; b.onclick = function () { window.etiSolicitarReprog(); }; document.body.appendChild(b); }
    b.textContent = '📝 ' + n + ' actividad(es) vencida(s) sin realizar · informar motivo';
  }

  window.etiSolicitarReprog = async function (preId) {
    var u = U(); if (!u) return;
    css();
    var m = document.getElementById('_srM'); if (m) m.remove();
    m = document.createElement('div'); m.id = '_srM';
    m.innerHTML = '<div class="bx"><h3>📝 Actividad no realizada en la fecha programada</h3><div class="sub">Cargando tus programaciones…</div></div>';
    document.body.appendChild(m);
    try { LISTA = await cargar(); } catch (e) { m.querySelector('.bx').innerHTML = '<h3>No se pudo cargar</h3><div class="sub">' + esc(e.message) + '</div><button class="bt" onclick="document.getElementById(\'_srM\').remove()">Cerrar</button>'; return; }
    var sel = null;
    LISTA.forEach(function (x) { if (x.id === preId && x.sinPedir.length) sel = x; });
    if (!sel) sel = LISTA.filter(function (x) { return x.sinPedir.length; })[0] || null;
    function pintar() {
      var h = '<h3>📝 Actividad no realizada en la fecha programada</h3>' +
        '<div class="sub">Indica por qué no se realizó. El coordinador <b>Joel Timoteo</b> recibirá el aviso y asignará la nueva fecha. ' +
        'Hasta que se reprograme, la fecha sigue contando como <b>no ejecutada</b> en tus KPIs.</div>';
      if (!LISTA.length) h += '<p style="margin:16px 0">✅ No tienes actividades vencidas sin realizar.</p>';
      LISTA.forEach(function (x) {
        var puede = x.sinPedir.length > 0;
        h += '<div class="it' + (sel === x ? ' on' : '') + (puede ? '' : ' no') + '" data-id="' + esc(x.id) + '"><b>' + esc(x.tema) + '</b>' + (x.sector ? ' · ' + esc(x.sector) : '') +
          '<br>Fechas vencidas: <b>' + x.vencidas.map(dm).join(', ') + '</b>' +
          (x.pendiente ? '<br><span class="sub">⏳ Ya pediste reprogramar ' + (x.pendiente.fechas || []).map(dm).join(', ') + ' (' + esc(x.pendiente.motivo) + ') — esperando la nueva fecha</span>' : '') + '</div>';
      });
      if (sel) {
        h += '<label>Motivo *</label><select id="_srMot"><option value="">— Selecciona —</option>' + MOTIVOS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>' +
          '<label>Detalle (qué pasó y cuándo se podría realizar) *</label><textarea id="_srDet" rows="3" maxlength="900"></textarea>';
      }
      h += '<div id="_srErr" style="color:#b91c1c;font-weight:700;font-size:13px;margin-top:8px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
        '<button class="bt" style="background:#e2e8f0" id="_srNo">Cerrar</button>' + (sel ? '<button class="bt" style="background:#0a2463;color:#fff" id="_srSi">Enviar al coordinador</button>' : '') + '</div>';
      m.querySelector('.bx').innerHTML = h;
      Array.prototype.forEach.call(m.querySelectorAll('.it'), function (el) {
        el.onclick = function () { var x = LISTA.filter(function (y) { return y.id === el.dataset.id; })[0]; if (x && x.sinPedir.length) { sel = x; pintar(); } };
      });
      m.querySelector('#_srNo').onclick = function () { m.remove(); };
      var si = m.querySelector('#_srSi'); if (si) si.onclick = enviar;
    }
    async function enviar() {
      var mot = m.querySelector('#_srMot').value, det = m.querySelector('#_srDet').value.trim(), err = m.querySelector('#_srErr');
      if (!mot) { err.textContent = 'Selecciona el motivo.'; return; }
      if (det.length < 10) { err.textContent = 'Escribe el detalle (mínimo 10 caracteres).'; return; }
      var b = m.querySelector('#_srSi'); b.disabled = true; b.textContent = 'Enviando…';
      try {
        var url = FS + sel.col + '/' + sel.id + '?key=' + KEY;
        var r = await fetch(url); if (!r.ok) throw new Error('No se pudo leer la programación (' + r.status + ')');
        var d = await r.json();
        var prev = (d.fields && d.fields.solicitudesReprog && d.fields.solicitudesReprog.arrayValue && d.fields.solicitudesReprog.arrayValue.values) || [];
        var s = { id: 's' + Date.now().toString(36), estado: 'PENDIENTE', motivo: mot, detalle: det, fechas: sel.sinPedir,
          usuario: String(u.usuario || ''), nombre: String((CUENTA && CUENTA.supervisorNombre) || u.nombre || ''), fecha: new Date().toISOString() };
        var body = { fields: { solicitudesReprog: { arrayValue: { values: prev.concat([enc(s)]) } } } };
        var w = await fetch(url + '&updateMask.fieldPaths=solicitudesReprog&currentDocument.updateTime=' + encodeURIComponent(d.updateTime),
          { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!w.ok) throw new Error(w.status === 400 || w.status === 409 || w.status === 412 ? 'La programación cambió mientras escribías. Vuelve a intentarlo.' : 'No se pudo guardar (' + w.status + ')');
        m.querySelector('.bx').innerHTML = '<h3>✅ Enviado</h3><p style="font-size:14px;line-height:1.5">Se registró el motivo y tu pedido de reprogramación de ' + sel.sinPedir.map(dm).join(', ') +
          '.<br>El coordinador asignará la nueva fecha; te aparecerá en tu calendario.</p><div style="text-align:right"><button class="bt" style="background:#0a2463;color:#fff" onclick="document.getElementById(\'_srM\').remove()">Listo</button></div>';
        refrescarBoton();
      } catch (e) { err.textContent = '⚠️ ' + e.message; b.disabled = false; b.textContent = 'Enviar al coordinador'; }
    }
    pintar();
  };

  /* Para el ADMINISTRADOR al reprogramar: marca como ATENDIDAS las solicitudes pendientes */
  window.etiSolicitudesAtendidas = function (lista, por) {
    return (Array.isArray(lista) ? lista : []).map(function (s) {
      if (String(s && s.estado).toUpperCase() !== 'PENDIENTE') return s;
      var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k]; });
      o.estado = 'ATENDIDA'; o.atendidaPor = por || ''; o.atendidaEn = new Date().toISOString();
      return o;
    });
  };
  window.etiSolicitudPendiente = function (p) {
    var l = (p && p.solicitudesReprog) || [], x = null;
    l.forEach(function (s) { if (String(s && s.estado).toUpperCase() === 'PENDIENTE') x = s; });
    return x;
  };

  setTimeout(refrescarBoton, 4000);
  setInterval(function () { if (!document.hidden) refrescarBoton(); }, 10 * 60 * 1000);
})();
