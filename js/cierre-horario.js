/* Sistema ETI Capacitaciones · cierre automatico de sesion por horario
   Extraido de script.js el 25-oct-2026 (_ETI_MODULAR_V1) SIN cambios de logica: solo se lee el estado
   compartido a traves de C (usuarioActual, supervisores, usuariosCuentas, esc, showToast, cerrarSesion). */
export function instalarCierreHorario(C) {
// ══════════════════════════════════════════════════════════════
// CIERRE AUTOMÁTICO DE SESIÓN POR HORARIO — Sistema ETI (Capacitaciones)
// Misma regla del portal RR.LL: C.supervisores de 05:30 a 17:00,
// L-V (temporada baja) / L-Sáb (alta, desde 27-jun). Fuera de horario:
// cuenta regresiva de 5 min y cierre forzado, registrado en /historial
// (visible para el administrador en el Monitor). Respeta accesos
// temporales otorgados vía GAS. No aplica al administrador.
// ══════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var AC_GAS='https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
  var AC_DB='https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
  var _acCard=null,_acT=null,_acExt=false,_acCerrando=false,_acPospon=0;

  function acUser(){ 
    try{
      if(!C.usuarioActual||!C.usuarioActual.usuario)return null;
      return {usuario:C.usuarioActual.usuario,nombre:C.usuarioActual.nombre,rol:C.usuarioActual.rol};
    }catch(e){return null;}
 }
  function acUkey(u){return String(u).toLowerCase().replace(/[.#$/\[\]]/g,'_');}
  function acEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function acFuera(u){
    if(!u)return false;
    if(String(u.rol||'').toLowerCase()!=='supervisor')return false;
    var a=new Date(),mes=a.getMonth()+1,dia=a.getDate(),dow=a.getDay(),h=a.getHours()+a.getMinutes()/60;
    var alta=mes>6||(mes===6&&dia>=27);
    if(!alta){ if(dow===0||dow===6)return true; } else { if(dow===0)return true; }
    return (h<5.5||h>=17);
  }

  function acQuitar(){clearInterval(_acT);_acT=null;if(_acCard&&_acCard.parentNode)_acCard.parentNode.removeChild(_acCard);_acCard=null;}

  function acCerrar(u){
    if(_acCerrando)return;
    _acCerrando=true;
    try{fetch(AC_DB+'/historial/'+acUkey(u.usuario)+'.json',{method:'POST',keepalive:true,
      body:JSON.stringify({ts:{'.sv':'timestamp'},evento:'cierre_automatico',pagina:'sistema-eti',modulo:'Sistema ETI · Capacitaciones'})})['catch'](function(){});}catch(e){}
    try{fetch(AC_DB+'/presencia/'+acUkey(u.usuario)+'.json',{method:'PATCH',keepalive:true,
      body:JSON.stringify({online:false})})['catch'](function(){});}catch(e){}
    setTimeout(function(){
      acQuitar();
      _acCerrando=false;
      try{ C.cerrarSesion(); }catch(e){}
    },500);
  }

  function acMostrar(u){
    if(_acCard||_acCerrando)return;
    var seg=300;
    _acCard=document.createElement('div');
    _acCard.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;max-width:360px;background:#0f172a;color:#f1f5f9;border-left:4px solid #ef4444;border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.45);font-size:13.5px;line-height:1.55;font-family:inherit;';
    var nom=String(u.nombre||u.usuario||'').trim().split(' ')[0]||'colega';
    nom=nom.charAt(0).toUpperCase()+nom.slice(1).toLowerCase();
    _acCard.innerHTML=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:800;color:#f87171;">'+
      '<span style="font-size:16px;">🔒</span><span>Fin de jornada — cierre automático</span></div>'+
      '<div style="margin-bottom:10px;">Estimado(a) <b>'+acEsc(nom)+'</b>: tu horario permitido en el Sistema ETI (Capacitaciones) ya finalizó '+
      '(<b>05:30 a 17:00</b>). Por seguridad, el sistema cerrará tu sesión automáticamente en '+
      '<b id="_acCuentaEti" style="color:#fbbf24;font-size:15px;">5:00</b> y el cierre quedará registrado para Coordinación.<br>'+
      '<span style="opacity:.85">Guarda lo que estés haciendo. Si necesitas trabajar fuera de horario, solicita un acceso temporal al coordinador Joel Timoteo.</span></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
      '<button type="button" data-acc="cerrar" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-weight:800;font-size:12.5px;cursor:pointer;">🚪 Guardar y cerrar ahora</button>'+
      (!_acExt?'<button type="button" data-acc="ext" style="background:#334155;color:#f1f5f9;border:none;border-radius:8px;padding:6px 14px;font-weight:800;font-size:12.5px;cursor:pointer;">🕒 Necesito 10 min más (única vez)</button>':'')+
      '</div>';
    document.body.appendChild(_acCard);
    _acCard.querySelector('[data-acc="cerrar"]').addEventListener('click',function(){acCerrar(u);});
    var ext=_acCard.querySelector('[data-acc="ext"]');
    if(ext)ext.addEventListener('click',function(){_acExt=true;_acPospon=Date.now()+10*60*1000;acQuitar();});
    _acT=setInterval(function(){
      seg--;
      var el=document.getElementById('_acCuentaEti');
      if(el)el.textContent=Math.floor(seg/60)+':'+String(seg%60).padStart(2,'0');
      if(seg<=0){acQuitar();acCerrar(u);}
    },1000);
  }

  function acVerificar(){
    var u=acUser();
    if(!u||_acCerrando){if(!u)acQuitar();return;}
    if(_acCard){ if(!acFuera(u))acQuitar(); return; }
    if(Date.now()<_acPospon)return;
    if(!acFuera(u))return;
    fetch(AC_GAS,{method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action:'verificarAccesoTemporal',usuario:u.usuario})})
      .then(function(r){return r.json();})['catch'](function(){return null;})
      .then(function(d){
        if(d&&d.success&&d.tieneAcceso){_acPospon=Date.now()+30*60*1000;return;}
        var u2=acUser();
        if(u2&&acFuera(u2))acMostrar(u2);
      });
  }
  setTimeout(acVerificar,15000);
  setInterval(acVerificar,60000);
})();
}
