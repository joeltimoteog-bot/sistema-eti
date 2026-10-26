/* Sistema ETI Capacitaciones · alerta global de pendientes (RR.LL. + ETI)
   Extraido de script.js el 25-oct-2026 (_ETI_MODULAR_V1) SIN cambios de logica: solo se lee el estado
   compartido a traves de C (usuarioActual, supervisores, usuariosCuentas, esc, showToast, cerrarSesion). */
export function instalarAlertasPendientes(C) {
// ══════════════════════════════════════════════════════════════
// ALERTA GLOBAL DE PENDIENTES — seguimiento de gestión
// Junta pendientes de los 3 sistemas: RR.LL (informes de visitas y casos
// sin cerrar, vía GAS), Capacitaciones ETI (programaciones_eti) y
// Evaluaciones ETI (programaciones_eval) del Firestore sistema-eti-verfrut.
// Tarjeta flotante persistente: solo se minimiza; desaparece al cumplir.
// ══════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var GAS='https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
  var FS='https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/';
  var KEY='AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
  var REFRESCO=10*60*1000, REABRIR=30*60*1000;
  var _min=false,_reT=null,_tenia=false,_ultFetch=0,_activo=false;

  function getU(){ 
    try{
      if(!C.usuarioActual||!C.usuarioActual.usuario)return null;
      if(C.usuarioActual.rol==='admin')return null;
      return {usuario:C.usuarioActual.usuario,nombre:C.usuarioActual.nombre||C.usuarioActual.usuario};
    }catch(e){return null;}
 }

  function norm(s){return String(s||'').toUpperCase().replace(/\s+/g,' ').trim();}
  function coincide(a,b){
    a=norm(a);b=norm(b);
    if(!a||!b)return false;
    if(a===b)return true;
    var A=a.split(' ').filter(function(w){return w.length>2;});
    var B=b.split(' ').filter(function(w){return w.length>2;});
    var ig=function(x,y){return x===y||(x.length>=4&&y.length>=4&&(x.indexOf(y)===0||y.indexOf(x)===0));};
    var c=A.filter(function(w){return B.some(function(v){return ig(w,v);});}).length;
    return c>=3||(c>=2&&(A.length<=2||B.length<=2));
  }
  function escA(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function fsVal(v){
    if(!v)return null;
    if(v.stringValue!==undefined)return v.stringValue;
    if(v.integerValue!==undefined)return Number(v.integerValue);
    if(v.doubleValue!==undefined)return v.doubleValue;
    if(v.booleanValue!==undefined)return v.booleanValue;
    if(v.arrayValue)return (v.arrayValue.values||[]).map(fsVal);
    if(v.mapValue){var o={},f=v.mapValue.fields||{};Object.keys(f).forEach(function(k){o[k]=fsVal(f[k]);});return o;}
    return null;
  }
  function fsDocs(j){return (j&&j.documents||[]).map(function(d){var o={},f=d.fields||{};Object.keys(f).forEach(function(k){o[k]=fsVal(f[k]);});return o;});}
  function fsGet(col){return fetch(FS+col+'?pageSize=300&key='+KEY).then(function(r){return r.json();}).then(fsDocs);}
  function hoyISO(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function fmtD(iso){try{return new Date(iso+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'});}catch(e){return iso||'';}}

  function cargarCaps(u){
    return Promise.all([fsGet('usuarios_eti')['catch'](function(){return[];}),fsGet('programaciones_eti')['catch'](function(){return[];})])
      .then(function(res){
        var cuentas=res[0],progs=res[1],hoy=hoyISO(),lista=[];
        var cta=cuentas.find(function(c){return String(c.usuario||'').toLowerCase()===String(u.usuario).toLowerCase();});
        var nSup=(cta&&cta.supervisorNombre)||u.nombre;
        progs.forEach(function(p){
          if(p.estado==='ejecutada')return;
          if(!coincide(p.supervisor||'',nSup)&&!coincide(p.supervisor||'',u.nombre))return;
          var fechas=(p.fechas&&p.fechas.length?p.fechas.slice().sort():[p.fechaProgramada,p.fechaFin||p.fechaProgramada].filter(Boolean).sort());
          if(!fechas.length)return;
          var ini=fechas[0],fin=fechas[fechas.length-1],estado,dias,venc=false;
          if(hoy>fin){dias=Math.round((new Date(hoy)-new Date(fin))/86400000);estado='VENCIDA — '+dias+' día(s) de atraso';venc=true;}
          else if(hoy>=ini){estado=(ini===fin)?'programada para HOY':'EN CURSO';}
          else{dias=Math.round((new Date(ini)-new Date(hoy))/86400000);if(dias>7)return;estado='próxima — en '+dias+' día(s)';}
          lista.push({tema:p.tema||'Capacitación ETI',sector:p.sector||'',
                      fechasTxt:ini===fin?fmtD(ini):fmtD(ini)+' al '+fmtD(fin),estado:estado,vencida:venc});
        });
        return lista;
      });
  }
  function cargarEvals(u){
    return fsGet('programaciones_eval')['catch'](function(){return[];}).then(function(progs){
      var hoy=hoyISO(),lista=[];
      progs.forEach(function(p){
        if(p.estado==='ejecutada')return;
        if(!coincide(p.sup||'',u.nombre))return;
        var ejec=p.fechasEjecutadas||[];
        var pend=(p.fechas||[]).filter(function(f){return ejec.indexOf(f)<0;}).sort();
        if(!pend.length)return;
        var venc=pend.filter(function(f){return f<hoy;});
        var prox=pend.filter(function(f){return f>=hoy;});
        if(!venc.length){
          if(!prox.length)return;
          var d=Math.round((new Date(prox[0])-new Date(hoy))/86400000);
          if(d>7)return;
          lista.push({fechasTxt:pend.map(fmtD).join(' · '),vencida:false,
                      estado:d===0?'programada para HOY':'próxima — en '+d+' día(s)'});
        }else{
          lista.push({fechasTxt:pend.map(fmtD).join(' · '),vencida:true,
                      estado:'VENCIDA — la fecha programada ya pasó y aún no registras'});
        }
      });
      return lista;
    });
  }
  function cargarRRLL(u){
    return fetch(GAS+'?'+new URLSearchParams({action:'getCumplimiento',usuario:u.usuario||''}))
      .then(function(r){return r.json();})
      .then(function(res){
        if(!res||!res.success)return{visitas:[],casos:0};
        var visitas=(res.pendientesVisitas||[]).filter(function(p){return coincide(p.nombre,u.nombre);}).map(function(p){return p.estado||'vencido';});
        var casos=(res.casosPendientes||[]).filter(function(p){return coincide(p.nombre_mostrar,u.nombre);}).length;
        return{visitas:visitas,casos:casos};
      })['catch'](function(){return{visitas:[],casos:0};});
  }

  function pila(u){var n=String(u.nombre||u.usuario||'').trim().split(' ')[0]||'colega';return n.charAt(0).toUpperCase()+n.slice(1).toLowerCase();}
  function quitarUI(){['_apV6Card','_apV6Pill'].forEach(function(id){var el=document.getElementById(id);if(el&&el.parentNode)el.parentNode.removeChild(el);});}

  function renderPill(u,total){
    quitarUI();
    var pill=document.createElement('button');
    pill.id='_apV6Pill';pill.type='button';
    pill.innerHTML='⏰ '+total+' pendiente(s)';
    pill.style.cssText='position:fixed;bottom:20px;left:250px;z-index:2147482000;background:#f59e0b;color:#451a03;border:none;border-radius:999px;padding:9px 16px;font-weight:800;font-size:12.5px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);animation:_apV6Pulso 1.6s infinite;font-family:inherit;';
    pill.title='Ver mis pendientes';
    pill.addEventListener('click',function(){_min=false;actualizar();});
    document.body.appendChild(pill);
    if(!document.getElementById('_apV6Kf')){
      var st=document.createElement('style');st.id='_apV6Kf';
      st.textContent='@keyframes _apV6Pulso{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}';
      document.head.appendChild(st);
    }
    clearTimeout(_reT);
    _reT=setTimeout(function(){_min=false;actualizar();},REABRIR);
  }

  function renderCard(u,caps,evals,rrll){
    quitarUI();
    var items='';
    caps.forEach(function(c){
      items+='<div style="background:rgba(56,189,248,.10);border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:9px 11px;margin-top:8px;">'+
        '🎓 <b>Capacitación de Ética Social programada:</b> '+escA(c.tema)+(c.sector?' · '+escA(c.sector):'')+
        '<br>Fechas designadas: <b>'+escA(c.fechasTxt)+'</b> — <b style="color:'+(c.vencida?'#f87171':'#7dd3fc')+'">'+escA(c.estado)+'</b>'+
        '<br><span style="opacity:.85">'+(c.vencida?'Aún no la registras en el módulo de Capacitaciones ETI y la fecha programada ya venció. ':'')+
        'Recuerda realizarla y registrarla según el correo enviado por el coordinador Joel Timoteo.</span></div>';
    });
    evals.forEach(function(ev){
      items+='<div style="background:rgba(250,204,21,.10);border:1px solid rgba(250,204,21,.35);border-radius:10px;padding:9px 11px;margin-top:8px;">'+
        '⭐ <b>Evaluación de Ética Social programada:</b> fechas <b>'+escA(ev.fechasTxt)+'</b> — <b style="color:'+(ev.vencida?'#f87171':'#fde047')+'">'+escA(ev.estado)+'</b>'+
        '<br><span style="opacity:.85">'+(ev.vencida?'Todavía no registras tus evaluaciones en el Sistema de Evaluaciones ETI. Por favor regístralas o coordina tu reprogramación. ':'Recuerda registrar tus evaluaciones en el Sistema de Evaluaciones ETI en las fechas programadas.')+'</span></div>';
    });
    rrll.visitas.forEach(function(est){
      items+='<div style="background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:9px 11px;margin-top:8px;">'+
        '📋 <b>Informe de visitas '+(est==='plazo_hoy'?'(el plazo vence HOY)':'(VENCIDO)')+':</b> '+
        (est==='plazo_hoy'?'recuerda que hoy vence el plazo para subir tu informe de visitas.':'tienes vencido el informe de visitas de la semana pasada. Por favor regularízalo hoy.')+'</div>';
    });
    if(rrll.casos){
      items+='<div style="background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:9px 11px;margin-top:8px;">'+
        '📁 <b>'+rrll.casos+' caso(s) con informe de investigación sin cerrar:</b> registrados sin informe ni reporte subido en Registro de Casos del Sistema RR.LL. Por favor ciérralos antes de que venzan.</div>';
    }
    var card=document.createElement('div');
    card.id='_apV6Card';
    card.style.cssText='position:fixed;bottom:20px;left:250px;z-index:2147482000;width:340px;max-width:calc(100vw - 40px);max-height:calc(100vh - 190px);overflow-y:auto;background:#0f172a;color:#f1f5f9;border-left:4px solid #f59e0b;border-radius:14px;padding:14px 16px;box-shadow:0 14px 40px rgba(0,0,0,.5);font-size:13px;line-height:1.5;font-family:inherit;';
    card.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">'+
      '<div style="font-weight:800;color:#fbbf24;">⏰ Seguimiento de tu gestión</div>'+
      '<button type="button" id="_apV6Min" title="Minimizar (la alerta seguirá activa)" style="background:#334155;color:#f1f5f9;border:none;border-radius:8px;padding:3px 10px;font-weight:800;cursor:pointer;">—</button></div>'+
      '<div>Hola, <b>'+escA(pila(u))+'</b> 👋 — tienes pendientes que requieren tu atención:</div>'+items+
      '<div style="margin-top:10px;font-size:12px;opacity:.85;border-top:1px solid #334155;padding-top:8px;">'+
      'Esta alerta es parte del <b>seguimiento de tu gestión</b> y se cerrará automáticamente cuando registres tus pendientes. '+
      'Si no podrás cumplir en las fechas programadas, comunícate con el coordinador <b>Joel Timoteo</b> para reprogramar y ponerte al día en los tiempos prudentes dispuestos por tu jefatura.</div>';
    document.body.appendChild(card);
    card.querySelector('#_apV6Min').addEventListener('click',function(){
      _min=true;
      renderPill(u,caps.length+evals.length+rrll.visitas.length+(rrll.casos?1:0));
    });
  }

  function actualizar(){
    var u=getU();
    if(!u){quitarUI();_tenia=false;return;}
    Promise.all([cargarCaps(u)['catch'](function(){return[];}),
                 cargarEvals(u)['catch'](function(){return[];}),
                 cargarRRLL(u)])
      .then(function(res){
        if(!getU()){quitarUI();return;}
        var caps=res[0]||[],evals=res[1]||[],rrll=res[2]||{visitas:[],casos:0};
        var total=caps.length+evals.length+rrll.visitas.length+(rrll.casos?1:0);
        if(!total){
          quitarUI();
          if(_tenia){_tenia=false;
            var ok=document.createElement('div');
            ok.style.cssText='position:fixed;top:16px;right:16px;z-index:2147482100;background:#0f172a;color:#f1f5f9;border-left:4px solid #22c55e;border-radius:12px;padding:12px 14px;box-shadow:0 12px 34px rgba(0,0,0,.35);font-size:13px;line-height:1.5;max-width:320px;font-family:inherit;';
            ok.innerHTML='<b style="color:#4ade80">✅ ¡Ya estás al día, '+escA(pila(u))+'!</b><br>Gracias por cumplir con lo programado.';
            document.body.appendChild(ok);
            setTimeout(function(){if(ok.parentNode)ok.parentNode.removeChild(ok);},10000);
          }
          return;
        }
        _tenia=true;
        if(_min)renderPill(u,total);else renderCard(u,caps,evals,rrll);
      })['catch'](function(){});
  }

  // Vigilar sesión: cuando el usuario inicia sesión, activar; al salir, limpiar.
  setInterval(function(){
    var u=getU();
    if(u&&!_activo){_activo=true;_ultFetch=Date.now();actualizar();}
    else if(u&&_activo&&Date.now()-_ultFetch>=REFRESCO){_ultFetch=Date.now();actualizar();}
    else if(!u&&_activo){_activo=false;_tenia=false;quitarUI();}
  },5000);
})();

}
