/* ═══════════════════════════════════════════════════════════════════════════
   eti-pantallas.js — _ETI_PANTALLAS_V1 (25-nov-2026, decision de Joel)
   "Todo modulo se designa desde Acceso a Modulos del Sistema RR.LL."
   Cada pantalla de Capacitaciones ETI tiene su casilla (claves etiv_<pantalla>).
   _ETI_PANTALLAS_V2 (26-nov-2026): las casillas DAN y QUITAN. Encendida = la ve aunque su rol no la tenga
   (Dashboard, Programacion, Registrar, Registros, Ranking, Estadisticas). Mi Panel y Usuarios solo quitan.
   Al administrador del sistema ETI no se le quita nada.
   El servidor (auth/sso, accion sesion) dice cuales estan APAGADAS para el usuario
   y aqui se ocultan del menu; si alguien llega a una pantalla apagada se le lleva
   a la primera que si tiene.
   - Las casillas solo QUITAN: lo que el rol no muestra sigue sin mostrarse.
   - Sin casilla guardada la pantalla sigue como siempre (nadie pierde nada).
   - El creador (jtimoteo) nunca se restringe.
   - Si el servidor no responde, o la sesion no trae el pase del RR.LL., no se oculta nada.
   Apagar en un navegador: localStorage.eti_pantallas = 'off'
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ETI_PANTALLAS_V1) return; window._ETI_PANTALLAS_V1 = true;
  var API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/auth/sso?forceFunctionRegion=sa-east-1';
  var PANT = ['dashboard', 'programacion', 'registro', 'tabla', 'ranking', 'estadisticas', 'usuarios', 'mipanel'];
  var DAN = { dashboard: 1, programacion: 1, registro: 1, tabla: 1, ranking: 1, estadisticas: 1 };
  var cerradas = {}, dadas = {}, tkVisto = '', pidiendo = false;
  function off() { try { return localStorage.getItem('eti_pantallas') === 'off'; } catch (e) { return false; } }
  function token() { try { return sessionStorage.getItem('eti_rl_token') || ''; } catch (e) { return ''; } }
  function pintarCss() {
    var st = document.getElementById('etiPantCss');
    if (!st) { st = document.createElement('style'); st.id = 'etiPantCss'; (document.head || document.documentElement).appendChild(st); }
    var r = esAdminEti() ? '' : Object.keys(cerradas).map(function (k) { return '#sideNav .tab-btn[data-tab="' + k + '"]{display:none!important}'; }).join('\n');
    if (st.textContent !== r) st.textContent = r;
  }
  /* administrador del sistema ETI: el unico a quien su rol le muestra la pantalla Usuarios */
  function esAdminEti() { var u = document.querySelector('#sideNav .tab-btn[data-tab="usuarios"]'); return !!u && u.style.display !== 'none'; }
  /* las casillas encendidas muestran la pantalla aunque el rol la haya ocultado */
  function dar() {
    if (off()) return;
    Object.keys(dadas).forEach(function (k) {
      var b = document.querySelector('#sideNav .tab-btn[data-tab="' + k + '"]');
      if (b && b.style.display === 'none') b.style.display = '';
    });
  }
  function visible(b) { try { return !!b && getComputedStyle(b).display !== 'none'; } catch (e) { return false; } }
  function vigilar() {
    dar(); pintarCss();
    if (off() || !Object.keys(cerradas).length || esAdminEti()) return;
    var act = document.querySelector('#sideNav .tab-btn.active');
    var k = act ? act.getAttribute('data-tab') : '';
    if (!k || !cerradas[k]) return;
    var otra = Array.prototype.filter.call(document.querySelectorAll('#sideNav .tab-btn[data-tab]'), function (b) { return !cerradas[b.getAttribute('data-tab')] && visible(b); })[0];
    if (otra) { try { otra.click(); } catch (e) {} }
  }
  function consultar() {
    if (off()) { if (Object.keys(cerradas).length) { cerradas = {}; dadas = {}; pintarCss(); } return; }
    var tk = token();
    if (!tk) { if (tkVisto) { tkVisto = ''; cerradas = {}; dadas = {}; pintarCss(); } return; }   /* cerro sesion */
    if (tk === tkVisto || pidiendo) return;
    pidiendo = true;
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'sesion', token: tk }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        pidiendo = false; tkVisto = tk;
        var u = j && j.success && j.user ? j.user : null;
        var p = u && u.accesos && u.accesos.eti && u.accesos.eti.pantallas;
        var c = {}, d = {};
        if (p && String(u.usuario || '').toLowerCase() !== 'jtimoteo') PANT.forEach(function (k) { if (p[k] === false) c[k] = true; else if (p[k] === true && DAN[k]) d[k] = true; });
        cerradas = c; dadas = d; pintarCss(); vigilar();
        if (Object.keys(c).length || Object.keys(d).length) console.log('[_ETI_PANTALLAS_V2] apagadas: ' + Object.keys(c).join(', ') + ' · dadas: ' + Object.keys(d).join(', '));
      })
      .catch(function () { pidiendo = false; });   /* sin respuesta: no se oculta nada y se reintenta */
  }
  setInterval(function () { consultar(); vigilar(); }, 1200);
  consultar();
  window._etiPantallas = { cerradas: function () { return Object.keys(cerradas); }, dadas: function () { return Object.keys(dadas); } };
})();
