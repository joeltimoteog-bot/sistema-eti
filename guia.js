/* ══════ _GUIA_V1 (20-set-2026) — Capacitaciones ETI
   Capa ADITIVA cargada al final de index.html. No modifica script.js.
   Lee la pestaña activa y el formulario, y muestra:
     · Tarjeta "¿Qué hago ahora?" con checklist y progreso por pestaña.
     · Asistente guionado (sin IA) con preguntas frecuentes y saltos de pestaña.
     · Tour de bienvenida la primera vez (localStorage eti_cap_tour_v1).
   Si algo falla, se ignora en silencio: el sistema sigue igual. */
(function(){
'use strict';
var CSS='#gDock{position:fixed;right:18px;bottom:76px;width:330px;max-width:calc(100vw - 36px);background:#fff;border:1px solid #D9E0EC;border-radius:16px;box-shadow:0 14px 40px rgba(11,30,69,.18);z-index:9000;font-family:Barlow,"Segoe UI",sans-serif;color:#14213D;display:none;overflow:hidden}#gDock.on{display:block}#gDock .gh{background:#0B1E45;color:#fff;padding:9px 14px;display:flex;align-items:center;gap:8px;cursor:pointer}#gDock .gh b{font:700 11px Barlow;letter-spacing:.14em;text-transform:uppercase;color:#FFD1D8}#gDock .gh span{margin-left:auto;font-size:14px}#gDock .gb{padding:12px 14px}#gDock.min .gb{display:none}#gDock h4{margin:0 0 4px;font:800 18px "Barlow Condensed",Barlow,sans-serif;color:#0B1E45;line-height:1.1}#gDock p{margin:0 0 9px;font-size:12.5px;color:#5B6B85;line-height:1.45}#gDock ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}#gDock li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:#14213D}#gDock li i{width:18px;height:18px;border-radius:6px;border:1.5px solid #D9E0EC;flex:none;display:grid;place-items:center;font:700 11px Barlow;font-style:normal;margin-top:1px;background:#fff}#gDock li.ok i{background:#007A3D;border-color:#007A3D;color:#fff}#gDock li.now{font-weight:700;color:#003DA5}#gDock li.now i{border-color:#003DA5;box-shadow:0 0 0 3px #BFD3F7}#gDock .gp{height:7px;background:#EAEFF6;border-radius:6px;overflow:hidden;margin:10px 0 3px}#gDock .gp i{display:block;height:100%;background:linear-gradient(90deg,#003DA5,#4C7BE0);transition:width .4s}#gDock .gn{font-size:11px;color:#5B6B85}#gDock .gt{margin-top:10px;background:#FFF4E5;border-radius:10px;padding:9px 11px;font-size:12px;color:#14213D}#gDock .gt b{color:#B45309}#gDock .ga{margin-top:10px;width:100%;padding:10px;border:none;border-radius:10px;background:#003DA5;color:#fff;font:700 13px Barlow;cursor:pointer}#gFab{position:fixed;right:18px;bottom:18px;background:#C8102E;color:#fff;border:none;border-radius:999px;padding:11px 16px;font:700 13px Barlow,sans-serif;cursor:pointer;box-shadow:0 12px 28px rgba(200,16,46,.35);display:none;gap:8px;align-items:center;z-index:9001}#gFab.on{display:flex}#gChat{position:fixed;right:18px;bottom:76px;width:360px;max-width:calc(100vw - 36px);height:480px;max-height:70vh;background:#fff;border:1px solid #D9E0EC;border-radius:16px;box-shadow:0 14px 40px rgba(11,30,69,.2);display:none;flex-direction:column;overflow:hidden;z-index:9002;font-family:Barlow,sans-serif;color:#14213D}#gChat.on{display:flex}#gChat .ch{background:#0B1E45;color:#fff;padding:11px 14px;display:flex;align-items:center;gap:10px}#gChat .ch .av{width:30px;height:30px;border-radius:50%;background:#C8102E;display:grid;place-items:center}#gChat .ch b{font:700 14px "Barlow Condensed",Barlow;letter-spacing:.04em}#gChat .ch small{display:block;font-size:11px;color:#B8C7E6}#gChat .ch button{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer}#gChat .cl{flex:1;overflow:auto;padding:14px;display:grid;gap:10px;align-content:start}#gChat .m{max-width:88%;padding:9px 12px;border-radius:12px;font-size:12.5px;line-height:1.45}#gChat .m.b{background:#EEF3FB;border-bottom-left-radius:4px}#gChat .m.u{background:#003DA5;color:#fff;justify-self:end;border-bottom-right-radius:4px}#gChat .o{display:flex;flex-wrap:wrap;gap:6px}#gChat .o button{border:1.5px solid #003DA5;color:#003DA5;background:#fff;border-radius:999px;padding:6px 11px;font:600 12px Barlow;cursor:pointer}#gChat .o button.a{background:#003DA5;color:#fff}#gChat .o button:disabled{opacity:.6;cursor:default}#gChat .cf{border-top:1px solid #EAEFF6;padding:7px 12px;font-size:11px;color:#5B6B85}#gTour{position:fixed;inset:0;background:rgba(11,30,69,.62);z-index:9003;display:none;align-items:center;justify-content:center;padding:18px;font-family:Barlow,sans-serif}#gTour.on{display:flex}#gTour .tb{background:#fff;border-radius:16px;max-width:520px;width:100%;padding:22px 24px;color:#14213D;box-shadow:0 24px 70px rgba(0,0,0,.35)}#gTour .te{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#C8102E;font-weight:700}#gTour h3{margin:4px 0 6px;font:800 24px "Barlow Condensed",Barlow}#gTour p{margin:0;color:#5B6B85;font-size:13.5px;line-height:1.5}#gTour .td{display:flex;gap:6px;margin:14px 0}#gTour .td i{width:8px;height:8px;border-radius:50%;background:#D9E0EC}#gTour .td i.on{background:#003DA5}#gTour .tc{display:flex;gap:8px;justify-content:flex-end}#gTour .tc button{padding:10px 16px;border-radius:10px;border:none;font:700 13px Barlow;cursor:pointer}#gTour .ts{background:#EEF3FB;color:#003DA5}#gTour .tn{background:#003DA5;color:#fff}@media(max-width:640px){#gDock{right:10px;left:10px;width:auto;bottom:70px}#gChat{right:10px;left:10px;width:auto}}';
var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function tab(){var a=document.querySelector('.tab-content.active');return a?a.id.replace('tab-',''):'';}
function logueado(){var a=$('appPage');return !!(a&&a.style.display!=='none');}
function val(id){var e=$(id);return e?String(e.value||'').trim():'';}
/* script.js es un modulo: usuarioActual no es global. Se lee del DOM que pinta pintarUsuarioUI(). */
function esAdmin(){try{var b=document.querySelector('.tab-btn[data-tab="usuarios"]');return !!(b&&b.offsetParent!==null);}catch(e){return false;}}
function nombre(){try{var t=String(($('userBadge')||{}).textContent||'').trim();t=t.replace(/\s*[·(|-].*$/,'');return t.split(' ')[0];}catch(e){return '';}}
function irTab(t){var b=document.querySelector('.tab-btn[data-tab="'+t+'"]');if(b&&b.offsetParent!==null||b){try{b.click();}catch(e){}}}
function num(id){var e=$(id);return e?String(e.textContent||'').trim():'';}

function guia(){
  var t=tab(), n=nombre();
  if(t==='mipanel'){
    var v=parseInt(num('skVencidas'),10)||0,p=parseInt(num('skPendientes'),10)||0,pr=parseInt(num('skProximas'),10)||0,e=parseInt(num('skEjecutadas'),10)||0;
    var items=[[v?'now':'ok', v?v+' capacitación(es) vencida(s): regularízalas hoy':'Sin capacitaciones vencidas'],[pr?'':'ok', pr?pr+' próxima(s) esta semana':'Nada próximo a vencer'],['',e+' ejecutada(s) este periodo']];
    return {h:(n?'Hola '+n+', ':'')+'este es tu panel',p:'Aquí ves tus capacitaciones programadas, cuáles ya ejecutaste y cuáles vencen. Registra cada una en cuanto la realices.',items:items,tip:v?'<b>Tienes vencidas.</b> Ábrelas desde la lista de abajo y registra la ejecución con las actas: tu cumplimiento se actualiza al instante.':'<b>Tip:</b> registra la capacitación el mismo día que la ejecutas para que el envío de actas no se atrase.',btn:p||v?['Registrar una capacitación',function(){irTab('registro');}]:null};
  }
  if(t==='registro'){
    var c=[['Supervisor',!!val('fSupervisor')],['Tema de capacitación',!!val('fTema')],['Fecha de ejecución',!!val('fFechaEjecucion')],['Personal capacitado (varones/mujeres)',!!(val('fVarones')||val('fMujeres'))]];
    var ok=0,first=-1;var items2=c.map(function(x,i){if(x[1])ok++;else if(first<0)first=i;return [x[1]?'ok':'',x[0]];});if(first>=0)items2[first][0]='now';
    return {h:'Registra la capacitación',p:'Completa los datos en orden: al elegir el tema aparecerán las rutas o áreas y el personal capacitado.',items:items2,prog:Math.round(100*ok/c.length),nota:ok+' de '+c.length+' completados',tip:'<b>Actas:</b> la fecha de envío de actas define si la capacitación queda EN PLAZO o CON RETRASO. Si aún no las envías, déjala vacía y edítala después.'};
  }
  if(t==='programacion'){return {h:'Programación de capacitaciones',p:'Aquí se proyectan las capacitaciones por supervisor, tema y fecha. Cada programación luego se registra como ejecutada.',items:[['now','Elige supervisor, tema y fecha(s)'],['','Guarda la programación'],['','El supervisor la verá en Mi Panel']],tip:'Las programaciones vencidas sin registro aparecen en rojo en el Dashboard y en la campana de alertas.'};}
  if(t==='dashboard'){return {h:'Salud del sistema',p:'El semáforo resume el cumplimiento general; las tarjetas muestran totales, personal capacitado y retrasos.',items:[['now','Revisa el semáforo y los retrasos'],['','Abre Ranking para ver por supervisor'],['','Programa lo que falte']],tip:'Un retraso = capacitación ejecutada pero con actas enviadas fuera de plazo, o programación vencida sin registro.'};}
  if(t==='tabla'){return {h:'Historial de capacitaciones',p:'Filtra por supervisor, tema o fecha. Desde aquí puedes editar un registro o exportarlo a Excel.',items:[['now','Usa los filtros'],['','Edita si falta la fecha de actas'],['','Exporta a Excel si lo necesitas']],tip:'Los registros con actas pendientes se muestran con estado EN PROCESO.'};}
  if(t==='ranking'){return {h:'Ranking por supervisor',p:'Ordena por cumplimiento, personal capacitado o retrasos para ver quién necesita apoyo.',items:[['now','Identifica los de menor cumplimiento'],['','Revisa sus programaciones vencidas'],['','Coordina el refuerzo']],tip:'El ranking usa las mismas reglas que el Índice de Cumplimiento del Sistema RR.LL.'};}
  if(t==='estadisticas'){return {h:'Estadísticas',p:'Análisis histórico por mes, tema y sector; útil para el informe mensual.',items:[['now','Elige el periodo'],['','Compara temas y sectores'],['','Exporta el reporte']],tip:'Los datos vienen de los registros en la nube; se actualizan solos.'};}
  if(t==='usuarios'){return {h:'Usuarios',p:'Alta, baja y roles de los supervisores. Quien entra desde el Sistema RR.LL se crea solo como supervisor.',items:[['now','Verifica que cada supervisor tenga su cuenta'],['','Marca inactivos los que ya no están']],tip:'El acceso diario es desde el Sistema RR.LL; aquí no se manejan contraseñas.'};}
  return null;
}
function crear(){
  if($('gDock'))return;
  var d=document.createElement('div');d.id='gDock';d.innerHTML='<div class="gh" id="gDockH"><b>¿Qué hago ahora?</b><span id="gDockT">▾</span></div><div class="gb" id="gDockB"></div>';document.body.appendChild(d);
  $('gDockH').onclick=function(){d.classList.toggle('min');$('gDockT').textContent=d.classList.contains('min')?'▴':'▾';try{localStorage.setItem('eti_cap_guia_min',d.classList.contains('min')?'1':'0');}catch(e){}};
  try{if(localStorage.getItem('eti_cap_guia_min')==='1'){d.classList.add('min');$('gDockT').textContent='▴';}}catch(e){}
  var f=document.createElement('button');f.id='gFab';f.innerHTML='💬 ¿Necesitas ayuda?';f.onclick=toggleChat;document.body.appendChild(f);
  var c=document.createElement('div');c.id='gChat';c.setAttribute('role','dialog');
  c.innerHTML='<div class="ch"><div class="av">🤖</div><div><b>Asistente ETI</b><small>Capacitaciones · respuestas del área</small></div><button id="gChatMenu" title="Volver al menú" style="font-size:12px;font-weight:700;margin-left:auto;background:rgba(255,255,255,.15);border-radius:8px;padding:4px 8px">🏠 Menú</button><button id="gChatX" aria-label="Cerrar" style="margin-left:6px">✕</button></div><div class="cl" id="gLog"></div><div class="cf">Elige una opción. Si tu duda no está aquí, escribe a Joel Timoteo (960 853 224).</div>';
  document.body.appendChild(c);$('gChatX').onclick=function(){c.classList.remove('on');};$('gChatMenu').onclick=function(){$('gLog').innerHTML='';bot('inicio');};
  var tr=document.createElement('div');tr.id='gTour';tr.innerHTML='<div class="tb"><div class="te">Bienvenido a la nueva versión</div><h3 id="gTourT"></h3><p id="gTourP"></p><div class="td" id="gTourD"></div><div class="tc"><button class="ts" id="gTourS">Saltar</button><button class="tn" id="gTourN">Siguiente →</button></div></div>';
  document.body.appendChild(tr);$('gTourS').onclick=tourEnd;$('gTourN').onclick=tourNext;
}
function pintar(){
  var d=$('gDock'),f=$('gFab');if(!d)return;
  if(!logueado()){d.classList.remove('on');if(f)f.classList.remove('on');return;}
  if(f)f.classList.add('on');
  var g=guia();if(!g){d.classList.remove('on');return;}
  d.classList.add('on');
  var h='<h4>'+g.h+'</h4><p>'+g.p+'</p><ul>'+g.items.map(function(x){return '<li class="'+x[0]+'"><i>'+(x[0]==='ok'?'✓':'')+'</i><span>'+x[1]+'</span></li>';}).join('')+'</ul>';
  if(typeof g.prog==='number')h+='<div class="gp"><i style="width:'+g.prog+'%"></i></div><div class="gn">'+(g.nota||'')+'</div>';
  if(g.tip)h+='<div class="gt">'+g.tip+'</div>';
  if(g.btn)h+='<button class="ga" id="gDockA">'+g.btn[0]+'</button>';
  $('gDockB').innerHTML=h;if(g.btn){var b=$('gDockA');if(b)b.onclick=g.btn[1];}
}
var FLOW={
  inicio:{t:'Hola 👋 Soy el asistente de Capacitaciones ETI. ¿En qué te ayudo?',o:[['¿Cómo registro una capacitación?','registrar'],['¿Qué son las programaciones?','prog'],['¿Qué significa EN PLAZO / CON RETRASO?','plazo'],['¿Dónde veo mis pendientes?','pend'],['No me deja entrar','login']]},
  registrar:{t:'Ve a <b>Registrar Capacitación</b>. Elige supervisor, tema y fecha de ejecución; al elegir el tema aparecen las rutas o áreas y el personal capacitado (varones/mujeres). Guarda y listo.',o:[['Llévame ahí','tab:registro'],['¿Y las actas?','actas'],['Volver','inicio']]},
  actas:{t:'La <b>fecha de envío de actas</b> es la que define el cumplimiento. Si aún no las enviaste, déjala vacía: el registro queda EN PROCESO y lo completas después desde Registros.',o:[['Ir a Registros','tab:tabla'],['Volver','inicio']]},
  prog:{t:'Una <b>programación</b> es una capacitación proyectada para un supervisor, un tema y una o más fechas. El supervisor la ve en <b>Mi Panel</b> y, cuando la ejecuta, la registra desde ahí.',o:[['Ver Mi Panel','tab:mipanel'],['Volver','inicio']]},
  plazo:{t:'<b>EN PLAZO</b>: actas enviadas dentro del plazo. <b>CON RETRASO</b>: actas fuera de plazo o programación vencida sin registro. <b>EN PROCESO</b>: ejecutada pero sin fecha de actas.',o:[['Volver','inicio']]},
  pend:{t:'En <b>Mi Panel</b> tienes tus programaciones pendientes, próximas, vencidas y ejecutadas. La campana 🔔 de arriba muestra las alertas de vencimiento.',o:[['Ver Mi Panel','tab:mipanel'],['Volver','inicio']]},
  login:{t:'El ingreso es desde el <b>Sistema RR.LL</b>: entra ahí con tu usuario y contraseña y haz clic en <b>Capacitaciones ETI</b>. Entrarás directo, sin escribir tu clave otra vez.',o:[['Sigue sin entrar','login2'],['Volver','inicio']]},
  login2:{t:'Abre la tarjeta desde el RR.LL en la misma pestaña y entra dentro de 90 segundos. Si persiste, avisa a Joel Timoteo (960 853 224) con tu usuario.',o:[['Volver','inicio']]}
};
function toggleChat(){var c=$('gChat');if(!c)return;c.classList.toggle('on');if(c.classList.contains('on')){var log=$('gLog');if(!log.children.length||!log.querySelectorAll('.o button:not(:disabled)').length)bot('inicio');}}
function bot(k){var f=FLOW[k],log=$('gLog');if(!f||!log)return;var m=document.createElement('div');m.className='m b';m.innerHTML=f.t;log.appendChild(m);var o=document.createElement('div');o.className='o';
  f.o.forEach(function(p){var b=document.createElement('button');b.textContent=p[0];b.onclick=function(){o.querySelectorAll('button').forEach(function(x){x.disabled=true;});b.classList.add('a');var me=document.createElement('div');me.className='m u';me.textContent=p[0];log.appendChild(me);
    if(p[1].indexOf('tab:')===0){irTab(p[1].slice(4));setTimeout(pintar,50);var ok=document.createElement('div');ok.className='m b';ok.innerHTML='Listo, ya estás en esa pestaña ✅ ¿Algo más?';log.appendChild(ok);bot('inicio');}else bot(p[1]);log.scrollTop=log.scrollHeight;};o.appendChild(b);});
  log.appendChild(o);log.scrollTop=log.scrollHeight;}
var T=[['Así funciona Capacitaciones ETI','Programa, registra y da seguimiento a las capacitaciones. En cada pestaña, la tarjeta “¿Qué hago ahora?” te dice exactamente qué sigue.'],['Tu cumplimiento a la vista','Mi Panel muestra pendientes, próximas, vencidas y ejecutadas; el Dashboard y el Ranking, el estado general.'],['Ayuda en cualquier momento','El botón 💬 abre el asistente con preguntas frecuentes y te lleva a la pestaña correcta.']],ti=0;
function tourStart(){ti=0;tourPaint();$('gTour').classList.add('on');}
function tourPaint(){$('gTourT').textContent=T[ti][0];$('gTourP').textContent=T[ti][1];$('gTourD').innerHTML=T.map(function(_,i){return '<i class="'+(i===ti?'on':'')+'"></i>';}).join('');$('gTourN').textContent=ti===T.length-1?'Empezar ✓':'Siguiente →';}
function tourNext(){if(ti<T.length-1){ti++;tourPaint();}else tourEnd();}
function tourEnd(){$('gTour').classList.remove('on');try{localStorage.setItem('eti_cap_tour_v1','1');}catch(e){}}
window._etiTour=tourStart;
['input','change','click'].forEach(function(ev){document.addEventListener(ev,function(){clearTimeout(window._gT);window._gT=setTimeout(pintar,120);},true);});
var _tourHecho=false;
function arrancar(){crear();pintar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
setInterval(function(){pintar();try{if(!_tourHecho&&logueado()&&!localStorage.getItem('eti_cap_tour_v1')){_tourHecho=true;setTimeout(tourStart,900);}}catch(e){}},2000);
console.log('[_GUIA_V1] listo');
})();
