/* ============================================================
   SISTEMA ETI v4.0 – VERFRUT + FIREBASE
   Autor: Joel A. Timoteo Gonza – Relaciones Laborales
   ============================================================ */
'use strict';

// ─── FIREBASE CONFIG ──────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc",
  authDomain: "sistema-eti-verfrut.firebaseapp.com",
  projectId: "sistema-eti-verfrut",
  storageBucket: "sistema-eti-verfrut.firebasestorage.app",
  messagingSenderId: "209614676744",
  appId: "1:209614676744:web:23b4b1cd8c18b77e9742bd"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COL = 'capacitaciones';

// ─── USUARIOS ─────────────────────────────────────────────────
const USUARIOS = [
  { usuario:'jtimoteo',  nombre:'Joel A. Timoteo Gonza',   password:'jtimoteo2026',  rol:'admin'   },
  { usuario:'ovilela',   nombre:'Olga Vilela Ludeña',      password:'ovilela2026',   rol:'usuario' },
  { usuario:'jchavez',   nombre:'Jorge Chavez Cordova',    password:'jchavez2026',   rol:'usuario' },
  { usuario:'gcastillo', nombre:'Lucia Castillo Gonzalez', password:'gcastillo2026', rol:'usuario' }
];

const FESTIVOS_PERU = ['01-01','04-17','04-18','05-01','06-29','07-28','07-29','08-30','10-08','11-01','12-08','12-09','12-25'];

let registros = [];
let usuarioActual = null;
let unsubscribe = null;

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
});

// ─── LOGIN ────────────────────────────────────────────────────
function initLogin() {
  document.getElementById('btnLogin').addEventListener('click', intentarLogin);
  document.getElementById('loginPass').addEventListener('keypress', e => { if(e.key==='Enter') intentarLogin(); });
  document.getElementById('loginUser').addEventListener('keypress', e => { if(e.key==='Enter') document.getElementById('loginPass').focus(); });
}

function intentarLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const errDiv = document.getElementById('loginError');
  const found = USUARIOS.find(u => u.usuario===user && u.password===pass);
  if (!found) {
    errDiv.style.display='block';
    document.getElementById('loginPass').value='';
    document.getElementById('loginPass').focus();
    return;
  }
  errDiv.style.display='none';
  usuarioActual = found;
  document.getElementById('loginPage').style.display='none';
  document.getElementById('appPage').style.display='block';
  document.getElementById('userBadge').textContent = '👤 '+found.nombre+(found.rol==='admin'?' · Admin':'');
  const btnClear=document.getElementById('btnClearAll');
  if(btnClear) btnClear.style.display=found.rol==='admin'?'inline-flex':'none';
  actualizarHeaderFecha();
  initTabs();
  initForm();
  initBuscador();
  initModal();
  initBotones();
  initEstadisticas();
  initUnidades();
  initGerencial();
  // Escuchar cambios en tiempo real desde Firebase
  escucharFirebase();
}

function cerrarSesion() {
  if(unsubscribe) unsubscribe();
  if(unsubUnidades) unsubUnidades();
  if(unsubMant) unsubMant();
  if(unsubLic) unsubLic();
  if(unsubSupsGH) unsubSupsGH();
  if(unsubEvals) unsubEvals();
  if(unsubSegs) unsubSegs();
  usuarioActual=null;
  registros=[];
  unidadesData=[];mantenimientosData=[];licenciasData=[];
  supervisoresGH=[];evaluacionesData=[];seguimientosData=[];
  document.getElementById('appPage').style.display='none';
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
}

// ─── FIREBASE TIEMPO REAL ─────────────────────────────────────
function escucharFirebase() {
  showToast('🔄 Conectando con la base de datos…');
  const q = query(collection(db, COL), orderBy('creadoEn', 'desc'));
  unsubscribe = onSnapshot(q, (snapshot) => {
    registros = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      // Recalcular fecha límite y temporada siempre
      ...calcularFechaLimite(d.data().fechaEjecucion)
    }));
    renderAll();
    showToast('✅ Datos sincronizados correctamente.');
  }, (error) => {
    showToast('❌ Error al conectar con Firebase.', true);
    console.error(error);
  });
}

// ─── TABS ─────────────────────────────────────────────────────
function initTabs() {
  // Botones de módulo (nivel 1)
  document.querySelectorAll('.mod-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mod = btn.dataset.mod;
      document.querySelectorAll('.mod-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sub-bar').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const subBar = document.getElementById('sub-' + mod);
      if (subBar) {
        subBar.classList.add('active');
        const activeSubBtn = subBar.querySelector('.sub-btn.active') || subBar.querySelector('.sub-btn');
        if (activeSubBtn) activeSubBtn.click();
      }
    });
  });

  // Botones de sub-ítem (nivel 2)
  document.querySelectorAll('.sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      const sub = btn.dataset.sub;
      const subBar = btn.closest('.sub-bar');
      if (subBar) subBar.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const tabEl = document.getElementById('tab-' + target);
      if (tabEl) tabEl.classList.add('active');
      // Activar sub-tab interno si corresponde
      if (sub && tabEl) {
        tabEl.querySelectorAll('.inner-sub-content').forEach(c => c.classList.remove('active'));
        const subEl = document.getElementById(sub);
        if (subEl) subEl.classList.add('active');
        const innerNav = tabEl.querySelector('.inner-sub-nav');
        if (innerNav) {
          innerNav.querySelectorAll('.inner-sub-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.inner === sub);
          });
        }
      }
      // Llamar renders según corresponda
      if (target === 'dashboard') renderDashboard();
      if (target === 'tabla') renderTabla();
      if (target === 'ranking') renderRanking();
      if (target === 'estadisticas' && typeof renderEstadisticas === 'function') renderEstadisticas();
      if (sub === 'u-dashboard' && typeof uRenderDashboard === 'function') uRenderDashboard();
      if (sub === 'g-dashboard' && typeof gRenderDashboard === 'function') gRenderDashboard();
    });
  });

  // Botones de inner sub-nav (navegación dentro de tab-unidades / tab-gerencial)
  document.querySelectorAll('.inner-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inner = btn.dataset.inner;
      const tabContent = btn.closest('.tab-content');
      const innerNav = btn.closest('.inner-sub-nav');
      if (innerNav) innerNav.querySelectorAll('.inner-sub-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (tabContent) {
        tabContent.querySelectorAll('.inner-sub-content').forEach(c => c.classList.remove('active'));
        const innerEl = document.getElementById(inner);
        if (innerEl) innerEl.classList.add('active');
        // Sincronizar sub-btn del mod-nav superior
        const modId = tabContent.id.replace('tab-', '');
        document.querySelectorAll('.sub-btn[data-tab="' + modId + '"]').forEach(b => {
          b.classList.toggle('active', b.dataset.sub === inner);
        });
      }
      if (inner === 'u-dashboard' && typeof uRenderDashboard === 'function') uRenderDashboard();
      if (inner === 'g-dashboard' && typeof gRenderDashboard === 'function') gRenderDashboard();
    });
  });
}

// ─── TEMPORADA ────────────────────────────────────────────────
function detectarTemporada(fecha) {
  const d=typeof fecha==='string'?new Date(fecha+'T12:00:00'):new Date(fecha);
  const val=(d.getMonth()+1)*100+d.getDate();
  return (val>=105&&val<=626)?'baja':'alta';
}
function esFestivo(fecha) {
  const mm=String(fecha.getMonth()+1).padStart(2,'0');
  const dd=String(fecha.getDate()).padStart(2,'0');
  return FESTIVOS_PERU.includes(mm+'-'+dd);
}
function esDiaHabil(fecha,temporada) {
  const dow=fecha.getDay();
  if(dow===0) return false;
  if(temporada==='baja'&&dow===6) return false;
  if(esFestivo(fecha)) return false;
  return true;
}
function calcularFechaLimite(fechaEjecStr) {
  const temporada=detectarTemporada(fechaEjecStr);
  let d=new Date(fechaEjecStr+'T12:00:00');
  let habiles=0;
  while(habiles<3){d.setDate(d.getDate()+1);if(esDiaHabil(d,temporada))habiles++;}
  return {fechaLimite:formatDate(d),temporada};
}
function contarDiasHabiles(desde,hasta,temporada) {
  let count=0,d=new Date(desde.getTime());
  d.setDate(d.getDate()+1);
  while(d<=hasta){if(esDiaHabil(d,temporada))count++;d.setDate(d.getDate()+1);}
  return count;
}

// ─── ESTADO ───────────────────────────────────────────────────
function calcularEstado(reg) {
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const fLimite=new Date(reg.fechaLimite+'T12:00:00');
  const fEjec=new Date(reg.fechaEjecucion+'T12:00:00');
  const temporada=reg.temporada||detectarTemporada(reg.fechaEjecucion);
  const fEnvio=reg.fechaEnvio?new Date(reg.fechaEnvio+'T12:00:00'):null;
  if(fEnvio) {
    if(fEnvio<=fLimite) return {estado:'cumplido',avance:100,retraso:0,diasRetraso:0};
    const dr=contarDiasHabiles(fLimite,fEnvio,temporada);
    const pct=Math.min(Math.round((dr/3)*100),100);
    return {estado:dr<=2?'leve':'critico',avance:Math.max(100-pct,0),retraso:pct,diasRetraso:dr};
  }
  if(hoy<=fLimite) {
    const du=contarDiasHabiles(fEjec,hoy,temporada);
    return {estado:'proceso',avance:Math.min(Math.round((du/3)*100),99),retraso:0,diasRetraso:0};
  }
  const dr=contarDiasHabiles(fLimite,hoy,temporada);
  const pct=Math.min(Math.round((dr/3)*100),100);
  return {estado:dr<=2?'leve':'critico',avance:Math.max(100-pct,0),retraso:pct,diasRetraso:dr};
}

// ─── HEADER ───────────────────────────────────────────────────
function actualizarHeaderFecha() {
  const hoy=new Date();
  const temporada=detectarTemporada(hoy);
  const badge=document.getElementById('seasonBadge');
  badge.textContent=temporada==='alta'?'🌡 Temporada Alta':'❄ Temporada Baja';
  badge.className='season-badge '+temporada;
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  document.getElementById('currentDate').textContent=`${dias[hoy.getDay()]}, ${hoy.getDate()} de ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

// ─── FORM ─────────────────────────────────────────────────────
function initForm() {
  document.getElementById('fSupervisor').addEventListener('change',function(){
    document.getElementById('fSector').value=this.value?this.value.split('|')[1]||'':'';
    verificarRetrasoForm();
  });
  ['fVarones','fMujeres'].forEach(id=>document.getElementById(id).addEventListener('input',calcularTotal));
  document.getElementById('fFechaEjecucion').addEventListener('change',verificarRetrasoForm);
  document.getElementById('fFechaEnvio').addEventListener('change',verificarRetrasoForm);
  document.querySelectorAll('input[name="tipoRutas"]').forEach(r=>{
    r.addEventListener('change',function(){
      document.getElementById('rutasNumeroCont').style.display=this.value==='numero'?'block':'none';
      document.getElementById('rutasVariasCont').style.display=this.value==='varias'?'block':'none';
    });
  });
  document.getElementById('fCantRutas').addEventListener('input',function(){generarFilasRutas(parseInt(this.value)||0);});
  document.getElementById('btnPreview').addEventListener('click',mostrarPreview);
  document.getElementById('etiForm').addEventListener('submit',e=>{e.preventDefault();guardarRegistro();});
}

function verificarRetrasoForm() {
  const fechaEjec=document.getElementById('fFechaEjecucion').value;
  const fechaEnvio=document.getElementById('fFechaEnvio').value;
  const obsAlert=document.getElementById('obsAlert');
  const obsField=document.getElementById('fObservaciones');
  if(!fechaEjec){obsAlert.style.display='none';obsField.style.borderColor='';return;}
  const {fechaLimite}=calcularFechaLimite(fechaEjec);
  const fLimite=new Date(fechaLimite+'T12:00:00');
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const hayRetraso=fechaEnvio?new Date(fechaEnvio+'T12:00:00')>fLimite:hoy>fLimite;
  if(hayRetraso){
    obsAlert.style.display='block';
    obsField.style.borderColor='#cc0000';
    obsField.placeholder='⚠️ OBLIGATORIO: Indica el motivo del retraso…';
  } else {
    obsAlert.style.display='none';
    obsField.style.borderColor='';
    obsField.placeholder='Observaciones adicionales…';
  }
}

function calcularTotal(){
  const v=parseInt(document.getElementById('fVarones').value)||0;
  const m=parseInt(document.getElementById('fMujeres').value)||0;
  document.getElementById('fTotal').value=(v+m)+' trabajadores';
}

function generarFilasRutas(cant){
  const cont=document.getElementById('rutasItemsCont');
  if(cant<1||cant>25){cont.innerHTML='';return;}
  let html=`<div class="ruta-header"><span>#</span><span>Código de Ruta</span><span>Nombre de Ruta</span></div>`;
  for(let i=1;i<=cant;i++){
    html+=`<div class="ruta-item-row"><div class="ruta-num">${i}</div>
      <input type="text" class="ruta-codigo" placeholder="Ej: RT-0${i}" maxlength="20"/>
      <input type="text" class="ruta-nombre" placeholder="Ej: Ruta Norte" maxlength="80"/></div>`;
  }
  cont.innerHTML=html;
}

function obtenerRutas(){
  const tipo=document.querySelector('input[name="tipoRutas"]:checked');
  if(!tipo) return {tipo:'ninguna',rutas:[]};
  if(tipo.value==='varias') return {tipo:'varias',rutas:[]};
  const rutas=[];
  document.querySelectorAll('.ruta-codigo').forEach((c,i)=>{
    const n=document.querySelectorAll('.ruta-nombre')[i];
    if(c.value.trim()||n.value.trim()) rutas.push({codigo:c.value.trim(),nombre:n.value.trim()});
  });
  return {tipo:'detalle',rutas};
}

function mostrarPreview(){
  const fechaE=document.getElementById('fFechaEjecucion').value;
  if(!fechaE){showToast('Ingresa la fecha de ejecución primero.',true);return;}
  const {fechaLimite,temporada}=calcularFechaLimite(fechaE);
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const restante=Math.round((new Date(fechaLimite+'T12:00:00')-hoy)/86400000);
  const v=parseInt(document.getElementById('fVarones').value)||0;
  const m=parseInt(document.getElementById('fMujeres').value)||0;
  document.getElementById('previewGrid').innerHTML=`
    <div class="preview-item"><div class="p-label">Temporada</div><div class="p-value">${temporada==='alta'?'🌡 Alta':'❄ Baja'}</div></div>
    <div class="preview-item"><div class="p-label">Días hábiles</div><div class="p-value">Lun–${temporada==='alta'?'Sáb':'Vie'}</div></div>
    <div class="preview-item highlight"><div class="p-label">Fecha Límite</div><div class="p-value">${formatDateDisplay(fechaLimite)}</div></div>
    <div class="preview-item"><div class="p-label">Estado</div><div class="p-value">${restante>=0?'✅ En plazo':'🔴 Vencido'}</div></div>
    <div class="preview-item"><div class="p-label">Total</div><div class="p-value">${v+m} (${v}♂ + ${m}♀)</div></div>`;
  document.getElementById('previewBox').style.display='block';
}

async function guardarRegistro(){
  const supVal=document.getElementById('fSupervisor').value;
  const varones=document.getElementById('fVarones').value;
  const mujeres=document.getElementById('fMujeres').value;
  const tema=document.getElementById('fTema').value;
  const fechaE=document.getElementById('fFechaEjecucion').value;
  const fechaEnv=document.getElementById('fFechaEnvio').value;
  const obs=document.getElementById('fObservaciones').value.trim();
  if(!supVal||varones===''||mujeres===''||!tema||!fechaE){showToast('Completa todos los campos obligatorios (*).', true);return;}
  const {fechaLimite,temporada}=calcularFechaLimite(fechaE);
  const fLimite=new Date(fechaLimite+'T12:00:00');
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const hayRetraso=fechaEnv?new Date(fechaEnv+'T12:00:00')>fLimite:hoy>fLimite;
  if(hayRetraso&&!obs){
    showToast('⚠️ Hay RETRASO. Debes indicar el motivo en Observaciones.', false, true);
    document.getElementById('fObservaciones').focus();
    document.getElementById('obsAlert').style.display='block';
    document.getElementById('fObservaciones').style.borderColor='#cc0000';
    return;
  }
  const [supervisor,sector]=supVal.split('|');
  const v=parseInt(varones)||0,m=parseInt(mujeres)||0;
  const rutasData=obtenerRutas();
  const reg={
    supervisor,sector,varones:v,mujeres:m,total:v+m,
    tema,fechaEjecucion:fechaE,fechaLimite,temporada,
    fechaEnvio:fechaEnv||null,observaciones:obs,
    rutasTipo:rutasData.tipo,rutas:rutasData.rutas,
    registradoPor:usuarioActual?usuarioActual.nombre:'',
    creadoEn:new Date().toISOString()
  };
  try {
    await addDoc(collection(db, COL), reg);
    showToast('✅ Registro guardado en la nube correctamente.');
    // Limpiar formulario
    document.getElementById('etiForm').reset();
    document.getElementById('fSector').value='';
    document.getElementById('fTotal').value='';
    document.getElementById('previewBox').style.display='none';
    document.getElementById('rutasNumeroCont').style.display='none';
    document.getElementById('rutasVariasCont').style.display='none';
    document.getElementById('rutasItemsCont').innerHTML='';
    document.getElementById('obsAlert').style.display='none';
    document.getElementById('fObservaciones').style.borderColor='';
    // Ir a tabla
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    document.querySelector('[data-tab="tabla"]').classList.add('active');
    document.getElementById('tab-tabla').classList.add('active');
  } catch(e) {
    showToast('❌ Error al guardar. Verifica tu conexión.', true);
    console.error(e);
  }
}

// ─── TABLA ────────────────────────────────────────────────────
let filtroTexto='';
function initBuscador(){document.getElementById('searchInput').addEventListener('input',e=>{filtroTexto=e.target.value.toLowerCase();renderTabla();});}
function renderTabla(){
  const tbody=document.getElementById('mainTableBody');
  const filtrados=registros.filter(r=>r.supervisor.toLowerCase().includes(filtroTexto)||r.sector.toLowerCase().includes(filtroTexto)||r.tema.toLowerCase().includes(filtroTexto));
  if(filtrados.length===0){tbody.innerHTML=`<tr><td colspan="16" class="no-records">No hay registros que mostrar.</td></tr>`;return;}
  tbody.innerHTML=filtrados.map((r,i)=>{
    const est=calcularEstado(r);
    const bc={cumplido:'badge-cumplido',proceso:'badge-proceso',leve:'badge-leve',critico:'badge-critico'}[est.estado];
    const el={cumplido:'✔ Cumplido',proceso:'⏳ En proceso',leve:'⚠ Retraso leve',critico:'🔴 Retraso crítico'}[est.estado];
    let rutasCell='<span class="cell-muted">–</span>';
    if(r.rutasTipo==='varias') rutasCell='<span class="badge badge-baja">Rutas Varias</span>';
    else if(r.rutasTipo==='detalle'&&r.rutas&&r.rutas.length>0) rutasCell=`<span title="${r.rutas.map(x=>x.codigo+' '+x.nombre).join(', ')}">${r.rutas.length} ruta(s)</span>`;
    const cr=est.retraso>50?'fill-red':'fill-orange';
    return `<tr>
      <td>${i+1}</td><td><strong>${esc(r.supervisor)}</strong></td><td>${esc(r.sector)}</td>
      <td class="text-right" style="color:#0050c8;font-weight:700">${r.varones}</td>
      <td class="text-right" style="color:#cc0000;font-weight:700">${r.mujeres}</td>
      <td class="text-right"><strong>${r.total}</strong></td>
      <td>${esc(r.tema)}</td><td>${rutasCell}</td>
      <td>${formatDateDisplay(r.fechaEjecucion)}</td><td>${formatDateDisplay(r.fechaLimite)}</td>
      <td>${r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'<span class="cell-muted">–</span>'}</td>
      <td><span class="badge ${r.temporada==='alta'?'badge-alta':'badge-baja'}">${r.temporada==='alta'?'🌡 Alta':'❄ Baja'}</span></td>
      <td><div class="progress-wrap"><div class="progress-bar"><div class="progress-fill fill-blue" style="width:${est.avance}%"></div></div><span class="progress-pct" style="color:#0050c8">${est.avance}%</span></div></td>
      <td><div class="progress-wrap"><div class="progress-bar"><div class="progress-fill ${cr}" style="width:${est.retraso}%"></div></div><span class="progress-pct" style="color:${est.retraso>0?'#cc0000':'#9aaabb'}">${est.retraso}%</span></div></td>
      <td><span class="badge ${bc}">${el}</span></td>
      <td><button class="btn btn-icon" onclick="abrirModal('${r.id}')" title="Editar">✏️</button>
          <button class="btn btn-icon" onclick="eliminarRegistro('${r.id}')" title="Eliminar">🗑</button></td></tr>`;
  }).join('');
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard(){
  let cumplido=0,proceso=0,leve=0,critico=0;
  const alertas=[];
  registros.forEach(r=>{
    const est=calcularEstado(r);
    if(est.estado==='cumplido') cumplido++;
    else if(est.estado==='proceso') proceso++;
    else if(est.estado==='leve') leve++;
    else critico++;
    const motivo=r.observaciones||'Sin observaciones registradas';
    if(est.estado==='critico') alertas.push({tipo:'critico',texto:`<strong>${r.supervisor}</strong> – ${r.sector} lleva <strong>${est.diasRetraso} día(s) hábil(es)</strong> de retraso crítico.`,extra:r.tema,motivo});
    else if(est.estado==='leve') alertas.push({tipo:'leve',texto:`<strong>${r.supervisor}</strong> – ${r.sector} tiene retraso leve (<strong>${est.diasRetraso} día/s</strong>).`,extra:r.tema,motivo});
    else if(est.estado==='proceso'){
      const restante=Math.round((new Date(r.fechaLimite+'T12:00:00')-new Date().setHours(0,0,0,0))/86400000);
      if(restante<=1) alertas.push({tipo:'proceso',texto:`<strong>${r.supervisor}</strong> vence ${restante===0?'<strong>HOY</strong>':'MAÑANA'} – ${r.sector}.`,extra:r.tema,motivo:''});
    }
  });
  const total=registros.length;
  document.getElementById('kpiTotal').textContent=total;
  document.getElementById('kpiCumplido').textContent=cumplido;
  document.getElementById('kpiProceso').textContent=proceso;
  document.getElementById('kpiRetraso').textContent=leve+critico;
  document.getElementById('kpiPct').textContent=total>0?Math.round((cumplido/total)*100)+'%':'0%';
  const al=document.getElementById('alertsList');
  if(alertas.length===0){al.innerHTML='<p class="empty-msg">✅ Sin alertas activas. Todo en orden.</p>';}
  else{
    const icons={critico:'🔴',leve:'⚠️',proceso:'⏰'};
    al.innerHTML=alertas.map(a=>`
      <div class="alert-item alert-${a.tipo}">
        <span class="alert-icon">${icons[a.tipo]}</span>
        <div class="alert-text">
          <span>${a.texto}</span>
          <small style="display:block;margin-top:3px;opacity:.85">📚 Tema: ${a.extra}</small>
          ${a.motivo?`<small style="display:block;margin-top:2px;font-style:italic">📝 Motivo retraso: ${a.motivo}</small>`:''}
        </div>
      </div>`).join('');
  }
  renderCharts(cumplido,proceso,leve,critico);
}

function renderCharts(cumplido,proceso,leve,critico){
  const dc=(id)=>{const c=Chart.getChart(id);if(c)c.destroy();};
  dc('chartEstado');
  new Chart(document.getElementById('chartEstado'),{type:'doughnut',data:{labels:['Cumplido','En Proceso','Retraso Leve','Retraso Crítico'],datasets:[{data:[cumplido,proceso,leve,critico],backgroundColor:['#1a8040','#1a6fd4','#e07a2a','#cc0000'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:11}}}},cutout:'65%'}});
  const sm={};
  registros.forEach(r=>{if(!sm[r.supervisor])sm[r.supervisor]={c:0,t:0};sm[r.supervisor].t++;if(calcularEstado(r).estado==='cumplido')sm[r.supervisor].c++;});
  const sl=Object.keys(sm),sp=sl.map(s=>Math.round((sm[s].c/sm[s].t)*100));
  dc('chartSupervisor');
  new Chart(document.getElementById('chartSupervisor'),{type:'bar',data:{labels:sl.map(s=>s.split(' ')[0]),datasets:[{label:'% Cumplimiento',data:sp,backgroundColor:'#003087',borderRadius:5}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:v=>v+'%'}}}}});
  const mm={},mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  registros.forEach(r=>{const m2=new Date(r.fechaEjecucion+'T12:00:00').getMonth();mm[m2]=(mm[m2]||0)+1;});
  const mk=Object.keys(mm).sort((a,b)=>a-b);
  dc('chartMes');
  new Chart(document.getElementById('chartMes'),{type:'line',data:{labels:mk.map(k=>mn[k]),datasets:[{label:'Registros',data:mk.map(k=>mm[k]),borderColor:'#0050c8',backgroundColor:'rgba(0,80,200,.10)',tension:.4,fill:true,pointRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}}}});
  const alta=registros.filter(r=>r.temporada==='alta').length;
  dc('chartTemporada');
  new Chart(document.getElementById('chartTemporada'),{type:'pie',
    data:{labels:['Temporada Alta','Temporada Baja'],datasets:[{data:[alta,registros.length-alta],backgroundColor:['#e8b94a','#0050c8'],borderWidth:0}]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:11}}}}}
  });
}

// ─── RANKING ──────────────────────────────────────────────────
function renderRanking(){
  const cont=document.getElementById('rankingContainer');
  if(registros.length===0){cont.innerHTML='<p class="empty-msg">No hay registros para generar ranking.</p>';return;}
  const map={};
  registros.forEach(r=>{if(!map[r.supervisor])map[r.supervisor]={c:0,p:0,ret:0,t:0,sector:r.sector};map[r.supervisor].t++;const e=calcularEstado(r).estado;if(e==='cumplido')map[r.supervisor].c++;else if(e==='proceso')map[r.supervisor].p++;else map[r.supervisor].ret++;});
  const ranking=Object.entries(map).map(([n,d])=>({n,...d,pct:Math.round((d.c/d.t)*100)})).sort((a,b)=>b.pct-a.pct||a.ret-b.ret);
  const medals=['gold','silver','bronze'];
  cont.innerHTML=ranking.map((r,i)=>`
    <div class="ranking-card ${i<3?'rank'+(i+1):''}">
      <div class="ranking-pos ${medals[i]||''}">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</div>
      <div class="ranking-info"><h4>${esc(r.n)}</h4><p>${esc(r.sector)} · ${r.t} reg · ${r.c} cumplidos · ${r.ret} retraso(s)</p></div>
      <div class="ranking-pct">${r.pct}%</div>
    </div>`).join('');
}

// ─── MODAL ────────────────────────────────────────────────────
function initModal(){
  document.getElementById('modalClose').addEventListener('click',cerrarModal);
  document.getElementById('btnCancelEdit').addEventListener('click',cerrarModal);
  document.getElementById('modalOverlay').addEventListener('click',e=>{if(e.target===document.getElementById('modalOverlay'))cerrarModal();});
  document.getElementById('editForm').addEventListener('submit',e=>{e.preventDefault();guardarEdicion();});
  document.getElementById('eSupervisor').addEventListener('change',function(){document.getElementById('eSector').value=this.value?this.value.split('|')[1]||'':'';});
}
function abrirModal(id){
  const reg=registros.find(r=>r.id===id);if(!reg)return;
  document.getElementById('editId').value=id;
  document.getElementById('eSupervisor').value=reg.supervisor+'|'+reg.sector;
  document.getElementById('eSector').value=reg.sector;
  document.getElementById('eVarones').value=reg.varones;
  document.getElementById('eMujeres').value=reg.mujeres;
  document.getElementById('eTema').value=reg.tema;
  document.getElementById('eFechaEjecucion').value=reg.fechaEjecucion;
  document.getElementById('eFechaEnvio').value=reg.fechaEnvio||'';
  document.getElementById('eObservaciones').value=reg.observaciones||'';
  document.getElementById('modalOverlay').style.display='flex';
}
function cerrarModal(){document.getElementById('modalOverlay').style.display='none';}
async function guardarEdicion(){
  const id=document.getElementById('editId').value;
  const supVal=document.getElementById('eSupervisor').value;
  const [supervisor,sector]=supVal.split('|');
  const fechaEjec=document.getElementById('eFechaEjecucion').value;
  const {fechaLimite,temporada}=calcularFechaLimite(fechaEjec);
  const v=parseInt(document.getElementById('eVarones').value)||0;
  const m=parseInt(document.getElementById('eMujeres').value)||0;
  try {
    await updateDoc(doc(db, COL, id), {
      supervisor,sector,varones:v,mujeres:m,total:v+m,
      tema:document.getElementById('eTema').value,
      fechaEjecucion:fechaEjec,fechaLimite,temporada,
      fechaEnvio:document.getElementById('eFechaEnvio').value||null,
      observaciones:document.getElementById('eObservaciones').value.trim()
    });
    cerrarModal();showToast('✏️ Registro actualizado en la nube.');
  } catch(e) { showToast('❌ Error al actualizar.', true); }
}

// ─── ELIMINAR ─────────────────────────────────────────────────
async function eliminarRegistro(id){
  if(!confirm('¿Eliminar este registro?'))return;
  try {
    await deleteDoc(doc(db, COL, id));
    showToast('🗑 Registro eliminado.');
  } catch(e) { showToast('❌ Error al eliminar.', true); }
}

// ─── EXPORTAR ─────────────────────────────────────────────────
function exportarExcel(){
  if(registros.length===0){showToast('No hay registros.',true);return;}
  const data=registros.map((r,i)=>{
    const est=calcularEstado(r);
    const el={cumplido:'Cumplido',proceso:'En Proceso',leve:'Retraso Leve',critico:'Retraso Crítico'}[est.estado];
    let ru='–';
    if(r.rutasTipo==='varias') ru='Rutas Varias';
    else if(r.rutas&&r.rutas.length>0) ru=r.rutas.map(x=>`[${x.codigo}] ${x.nombre}`).join(' | ');
    return {'#':i+1,'Supervisor':r.supervisor,'Sector':r.sector,'Varones':r.varones,'Mujeres':r.mujeres,'Total':r.total,
      'Tema':r.tema,'Rutas':ru,'F. Ejecución':formatDateDisplay(r.fechaEjecucion),
      'F. Límite':formatDateDisplay(r.fechaLimite),
      'F. Envío':r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'Pendiente',
      'Temporada':r.temporada==='alta'?'Alta':'Baja',
      '% Avance':est.avance+'%','% Retraso':est.retraso+'%',
      'Estado':el,'Días Retraso Hábiles':est.diasRetraso,
      'Observaciones':r.observaciones||''};
  });
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Capacitaciones ETI');
  const f=new Date();
  XLSX.writeFile(wb,`ETI_Verfrut_${f.getFullYear()}${String(f.getMonth()+1).padStart(2,'0')}${String(f.getDate()).padStart(2,'0')}.xlsx`);
  showToast('📥 Excel exportado.');
}

async function limpiarTodo(){
  if(!confirm('⚠️ ¿Eliminar TODOS los registros?'))return;
  if(!confirm('¿Confirmas?'))return;
  try {
    const snap=await getDocs(collection(db,COL));
    const promises=snap.docs.map(d=>deleteDoc(doc(db,COL,d.id)));
    await Promise.all(promises);
    showToast('🗑 Todos los registros eliminados.');
  } catch(e) { showToast('❌ Error al limpiar.', true); }
}

function initBotones(){
  document.getElementById('btnExportExcel').addEventListener('click',exportarExcel);
  const bc=document.getElementById('btnClearAll');
  if(bc) bc.addEventListener('click',limpiarTodo);
}

function renderAll(){renderDashboard();renderTabla();renderRanking();}

// ─── ESTADÍSTICO INDIVIDUAL ───────────────────────────────────
function initEstadisticas() {
  ['statSupervisor','statTipo','statPersonal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderEstadisticas);
  });
}

function renderEstadisticas() {
  const supVal = document.getElementById('statSupervisor').value;
  const tipoVal = document.getElementById('statTipo').value;
  const personalVal = document.getElementById('statPersonal').value;
  document.getElementById('statSectorDisplay').textContent =
    supVal ? (supVal.split('|')[1] || '–') : '— Se completa al elegir supervisor —';
  let filtrados = [...registros];
  if (supVal) filtrados = filtrados.filter(r => r.supervisor+'|'+r.sector === supVal);
  if (tipoVal) filtrados = filtrados.filter(r => r.tema === tipoVal);
  const totalV = filtrados.reduce((s,r) => s+(r.varones||0), 0);
  const totalM = filtrados.reduce((s,r) => s+(r.mujeres||0), 0);
  const totalT = filtrados.reduce((s,r) => s+(r.total||0), 0);
  let enPlazo=0,conRetraso=0,sumDias=0;
  filtrados.forEach(r => {
    const est = calcularEstado(r);
    if(est.estado==='cumplido'||est.estado==='proceso') enPlazo++;
    else { conRetraso++; sumDias += est.diasRetraso; }
  });
  const total = filtrados.length;
  document.getElementById('skpiActividades').textContent = total;
  document.getElementById('skpiTrabajadores').textContent = totalT;
  document.getElementById('skpiPlazo').textContent = enPlazo;
  document.getElementById('skpiRetraso').textContent = conRetraso;
  document.getElementById('skpiPctAvance').textContent = total>0 ? Math.round((enPlazo/total)*100)+'%' : '0%';
  document.getElementById('skpiPctRetraso').textContent = total>0 ? Math.round((conRetraso/total)*100)+'%' : '0%';
  document.getElementById('skpiPromDias').textContent = conRetraso>0 ? (sumDias/conRetraso).toFixed(1) : '0';
  const maxG = Math.max(totalV, totalM, 1);
  document.getElementById('sgBarVarones').style.width = Math.round((totalV/maxG)*100)+'%';
  document.getElementById('sgBarMujeres').style.width = Math.round((totalM/maxG)*100)+'%';
  document.getElementById('sgVaronesCount').textContent = totalV;
  document.getElementById('sgMujeresCount').textContent = totalM;
  document.getElementById('sgVaronesPct').textContent = totalT>0 ? Math.round((totalV/totalT)*100)+'%' : '0%';
  document.getElementById('sgMujeresPct').textContent = totalT>0 ? Math.round((totalM/totalT)*100)+'%' : '0%';
  const dc=(id)=>{const c=Chart.getChart(id);if(c)c.destroy();};
  dc('chartGeneroStats');
  new Chart(document.getElementById('chartGeneroStats'),{type:'doughnut',
    data:{labels:['Varones','Mujeres'],datasets:[{data:[totalV,totalM],backgroundColor:['#0050c8','#cc0000'],borderWidth:0}]},
    options:{responsive:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
  const enPlazoTotal = enPlazo, conRetrasoTotal = conRetraso;
  dc('chartAvanceRetraso');
  new Chart(document.getElementById('chartAvanceRetraso'),{type:'bar',
    data:{labels:['Resultado'],datasets:[
      {label:'En Plazo',data:[enPlazoTotal],backgroundColor:'#1a8040'},
      {label:'Con Retraso',data:[conRetrasoTotal],backgroundColor:'#cc0000'}]},
    options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}}});
  const mm={},mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  filtrados.forEach(r=>{const m=new Date(r.fechaEjecucion+'T12:00:00').getMonth();mm[m]=(mm[m]||0)+1;});
  const mk=Object.keys(mm).sort((a,b)=>a-b);
  dc('chartMesStats');
  new Chart(document.getElementById('chartMesStats'),{type:'line',
    data:{labels:mk.map(k=>mn[k]),datasets:[{label:'Actividades',data:mk.map(k=>mm[k]),borderColor:'#0050c8',backgroundColor:'rgba(0,80,200,.1)',tension:.4,fill:true,pointRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}}}});
  const secBody = document.getElementById('statsSectorBody');
  if (!supVal) {
    secBody.innerHTML = '<p class="stats-empty">Selecciona un supervisor para ver estadísticas del sector.</p>';
  } else {
    const cumplidos = filtrados.filter(r=>calcularEstado(r).estado==='cumplido').length;
    secBody.innerHTML = `<div style="font-size:13px;line-height:2;">
      <div>📋 Total actividades: <strong>${total}</strong></div>
      <div>✅ Cumplidas: <strong>${cumplidos}</strong></div>
      <div>📈 % Cumplimiento: <strong>${total>0?Math.round((cumplidos/total)*100)+'%':'0%'}</strong></div>
      <div>👥 Trabajadores: <strong>${totalT}</strong> (${totalV}♂ + ${totalM}♀)</div></div>`;
  }
  const rutasP = document.getElementById('statsRutasPanel');
  const areasP = document.getElementById('statsAreasPanel');
  if (personalVal === 'EMPLEADOS') { rutasP.style.display='none'; areasP.style.display='block'; }
  else { rutasP.style.display='block'; areasP.style.display='none'; }
}

// ─── MÓDULO UNIDADES Y LICENCIAS ──────────────────────────────
let unidadesData=[], mantenimientosData=[], licenciasData=[];
let unsubUnidades=null, unsubMant=null, unsubLic=null;

function initUnidades() {
  const qU = query(collection(db,'unidades'), orderBy('creadoEn','desc'));
  unsubUnidades = onSnapshot(qU, snap => {
    unidadesData = snap.docs.map(d=>({id:d.id,...d.data()}));
    uRenderDashboard(); uRenderTablaUnidades();
  }, e=>console.error('unidades:',e));
  const qM = query(collection(db,'mantenimientos'), orderBy('fecha','desc'));
  unsubMant = onSnapshot(qM, snap => {
    mantenimientosData = snap.docs.map(d=>({id:d.id,...d.data()}));
    uRenderDashboard(); uRenderTablaMant();
  }, e=>console.error('mantenimientos:',e));
  const qL = query(collection(db,'licencias'), orderBy('vencimiento','asc'));
  unsubLic = onSnapshot(qL, snap => {
    licenciasData = snap.docs.map(d=>({id:d.id,...d.data()}));
    uRenderDashboard(); uRenderTablaLic();
    uPoblarSelects();
  }, e=>console.error('licencias:',e));
  // Buttons
  const sb = id => document.getElementById(id);
  if(sb('uBtnExpUnid')) sb('uBtnExpUnid').addEventListener('click', uExportarUnidades);
  if(sb('uBtnExpMant')) sb('uBtnExpMant').addEventListener('click', uExportarMant);
  if(sb('uBtnExpLic'))  sb('uBtnExpLic').addEventListener('click', uExportarLic);
  if(sb('uBtnSaveLic')) sb('uBtnSaveLic').addEventListener('click', uGuardarLicencia);
  if(sb('uBtnClearLic')) sb('uBtnClearLic').addEventListener('click', ()=>{
    ['uLSup','uLNum','uLTipo','uLFExp','uLFReval'].forEach(i=>{const el=sb(i);if(el)el.value='';});
    ['uLDni','uLCod','uLCargo','uLDias','uLEstado'].forEach(i=>{const el=sb(i);if(el)el.value='';});
  });
  if(sb('uLFReval')) sb('uLFReval').addEventListener('change', uCalcLicEstado);
  ['uFiltDni','uFiltUser'].forEach(id=>{const el=sb(id);if(el)el.addEventListener('input',uRenderTablaUnidades);});
  ['uFiltEmp','uFiltEst'].forEach(id=>{const el=sb(id);if(el)el.addEventListener('change',uRenderTablaUnidades);});
  ['uFiltMUser','uFiltMTipo'].forEach(id=>{const el=sb(id);if(el)el.addEventListener('input',uRenderTablaMant);});
  ['uFiltLUser','uFiltLEst'].forEach(id=>{const el=sb(id);if(el)el.addEventListener('input',uRenderTablaLic);});
}

function uPoblarSelects() {
  const opts = unidadesData.map(u=>`<option value="${esc(u.id)}">${esc(u.usuario||'')} – ${esc(u.codInterno||'')}</option>`).join('');
  ['uLSup','uMSup'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.innerHTML='<option value="">— Seleccionar —</option>'+opts; }
  });
}

function uCalcLicEstado() {
  const fReval = document.getElementById('uLFReval').value;
  if(!fReval) return;
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const venc=new Date(fReval+'T12:00:00');
  const dias=Math.round((venc-hoy)/86400000);
  document.getElementById('uLDias').value = dias >= 0 ? dias+' días' : 'VENCIDA';
  let estado = 'vigente';
  if(dias<0) estado='vencido';
  else if(dias<=30) estado='critico';
  else if(dias<=60) estado='riesgo';
  else if(dias<=90) estado='por_vencer';
  document.getElementById('uLEstado').value = {vigente:'✅ Vigente',por_vencer:'⚠️ Por Vencer',riesgo:'🟠 Riesgo',critico:'🔴 Crítico',vencido:'❌ Vencida'}[estado];
}

async function uGuardarLicencia() {
  const supId=document.getElementById('uLSup').value;
  const num=document.getElementById('uLNum').value.trim();
  const tipo=document.getElementById('uLTipo').value;
  const fReval=document.getElementById('uLFReval').value;
  if(!supId||!num||!tipo||!fReval){showToast('Completa los campos obligatorios (*)',true);return;}
  const sup=unidadesData.find(u=>u.id===supId)||{};
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const venc=new Date(fReval+'T12:00:00');
  const dias=Math.round((venc-hoy)/86400000);
  let estado='vigente';
  if(dias<0)estado='vencido';else if(dias<=30)estado='critico';else if(dias<=60)estado='riesgo';else if(dias<=90)estado='por_vencer';
  try {
    await addDoc(collection(db,'licencias'),{
      supervisorId:supId,usuario:sup.usuario||'',dni:sup.dni||'',codInterno:sup.codInterno||'',
      cargo:sup.cargo||'',numLicencia:num,tipo,
      fechaExpedicion:document.getElementById('uLFExp').value||null,
      vencimiento:fReval,estado,diasRestantes:dias,
      creadoEn:new Date().toISOString()
    });
    showToast('✅ Licencia guardada.');
    document.getElementById('uBtnClearLic').click();
  } catch(e){showToast('❌ Error al guardar.',true);}
}

function uRenderDashboard() {
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const en30=new Date(hoy);en30.setDate(en30.getDate()+30);
  const operativas=unidadesData.filter(u=>u.estatus==='Operativo').length;
  const inoperativas=unidadesData.filter(u=>u.estatus==='Inoperativo').length;
  const vigentes=licenciasData.filter(l=>new Date(l.vencimiento+'T12:00:00')>=hoy).length;
  const porVencer=licenciasData.filter(l=>{const v=new Date(l.vencimiento+'T12:00:00');return v>=hoy&&v<=en30;}).length;
  const vencidas=licenciasData.filter(l=>new Date(l.vencimiento+'T12:00:00')<hoy).length;
  const alertaKm=unidadesData.filter(u=>u.kmActual&&u.kmProxMant&&(u.kmProxMant-u.kmActual)<=500).length;
  const s=id=>document.getElementById(id);
  s('ukTotal').textContent=unidadesData.length;
  s('ukOperativas').textContent=operativas;
  s('ukInoperativas').textContent=inoperativas;
  s('ukVigentes').textContent=vigentes;
  s('ukPorVencer').textContent=porVencer;
  s('ukVencidas').textContent=vencidas;
  s('ukMant').textContent=mantenimientosData.length;
  s('ukAlertaKm').textContent=alertaKm;
  // Alertas licencias
  const licVenc=licenciasData.filter(l=>new Date(l.vencimiento+'T12:00:00')<hoy);
  const licPV=licenciasData.filter(l=>{const v=new Date(l.vencimiento+'T12:00:00');return v>=hoy&&v<=en30;});
  const uA=s('uAlertas');
  if(uA) uA.innerHTML=(licVenc.length===0&&licPV.length===0)
    ?'<p class="unid-empty">Sin alertas activas.</p>'
    :[...licVenc.map(l=>`<div style="padding:5px 0;border-bottom:1px solid #fee2e2;font-size:12px;color:#cc0000;">🚨 <strong>${esc(l.usuario||'')}</strong> – vencida ${l.vencimiento}</div>`),
      ...licPV.map(l=>`<div style="padding:5px 0;border-bottom:1px solid #fef3c7;font-size:12px;color:#d97706;">⚠️ <strong>${esc(l.usuario||'')}</strong> – vence ${l.vencimiento}</div>`)].join('');
  const uAKm=s('uAlertasKm');
  const kmAlerts=unidadesData.filter(u=>u.kmActual&&u.kmProxMant&&(u.kmProxMant-u.kmActual)<=500);
  if(uAKm) uAKm.innerHTML=kmAlerts.length===0?'<p class="unid-empty">Sin alertas de kilometraje.</p>'
    :kmAlerts.map(u=>`<div style="padding:5px 0;font-size:12px;color:#ea580c;">🛵 <strong>${esc(u.usuario||'')}</strong> – ${esc(u.codInterno||'')} a ${(u.kmProxMant-u.kmActual)} km del mantenimiento</div>`).join('');
  // Charts
  const dc=id=>{const c=Chart.getChart(id);if(c)c.destroy();};
  dc('uChartUnid');
  new Chart(s('uChartUnid'),{type:'doughnut',data:{labels:['Operativas','Inoperativas'],datasets:[{data:[operativas,inoperativas],backgroundColor:['#16a34a','#dc2626'],borderWidth:0}]},options:{responsive:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
  dc('uChartLic');
  new Chart(s('uChartLic'),{type:'doughnut',data:{labels:['Vigentes','Por Vencer','Vencidas'],datasets:[{data:[Math.max(vigentes-porVencer,0),porVencer,vencidas],backgroundColor:['#16a34a','#d97706','#dc2626'],borderWidth:0}]},options:{responsive:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
  const mm={},mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  mantenimientosData.forEach(m=>{if(m.fecha){const mo=new Date(m.fecha+'T12:00:00').getMonth();mm[mo]=(mm[mo]||0)+1;}});
  const mk=Object.keys(mm).sort((a,b)=>a-b);
  dc('uChartMant');
  new Chart(s('uChartMant'),{type:'bar',data:{labels:mk.map(k=>mn[k]),datasets:[{label:'Mantenimientos',data:mk.map(k=>mm[k]),backgroundColor:'#3b82f6',borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
  const lm={};
  licenciasData.forEach(l=>{if(l.vencimiento){const mo=new Date(l.vencimiento+'T12:00:00').getMonth();lm[mo]=(lm[mo]||0)+1;}});
  const lk=Object.keys(lm).sort((a,b)=>a-b);
  dc('uChartLicMes');
  new Chart(s('uChartLicMes'),{type:'line',data:{labels:lk.map(k=>mn[k]),datasets:[{label:'Vencimientos',data:lk.map(k=>lm[k]),borderColor:'#d97706',backgroundColor:'rgba(217,119,6,.1)',tension:.4,fill:true,pointRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}}}});
}

function uRenderTablaUnidades() {
  const tbody=document.getElementById('uTbodyUnid');if(!tbody)return;
  const dni=(document.getElementById('uFiltDni')||{}).value||'';
  const user=(document.getElementById('uFiltUser')||{}).value||'';
  const emp=(document.getElementById('uFiltEmp')||{}).value||'';
  const est=(document.getElementById('uFiltEst')||{}).value||'';
  const f=unidadesData.filter(u=>
    (!dni||String(u.dni||'').toLowerCase().includes(dni.toLowerCase()))&&
    (!user||String(u.usuario||'').toLowerCase().includes(user.toLowerCase()))&&
    (!emp||u.empresa===emp)&&(!est||u.estatus===est));
  if(f.length===0){tbody.innerHTML=`<tr><td colspan="15" class="no-records">Sin registros.</td></tr>`;return;}
  tbody.innerHTML=f.map((u,i)=>`<tr>
    <td>${esc(u.dni||'–')}</td><td><strong>${esc(u.usuario||'–')}</strong></td><td>${esc(u.cargo||'–')}</td>
    <td>${esc(u.modelo||'–')}</td><td>${esc(u.marca||'–')}</td>
    <td><strong>${esc(u.codInterno||'–')}</strong></td><td>${esc(u.codSistema||'–')}</td>
    <td>${esc(u.motor||'–')}</td><td>${esc(u.chasis||'–')}</td><td>${u.anio||'–'}</td>
    <td><span style="font-weight:700;color:${u.estatus==='Operativo'?'#16a34a':'#dc2626'}">${u.estatus||'–'}</span></td>
    <td>${esc(u.zonaRecorrido||'–')}</td><td>${esc(u.empresa||'–')}</td>
    <td>${esc(u.zonaAbastecimiento||'–')}</td>
    <td><button class="unid-btn unid-btn-primary" style="padding:5px 9px;font-size:11px;" onclick="uAbrirModal('${u.id}')">✏️</button></td></tr>`).join('');
}

function uRenderTablaMant() {
  const tbody=document.getElementById('uTbodyMant');if(!tbody)return;
  const q=(document.getElementById('uFiltMUser')||{}).value||'';
  const t=(document.getElementById('uFiltMTipo')||{}).value||'';
  const f=mantenimientosData.filter(m=>(!q||String(m.supervisor||'').toLowerCase().includes(q.toLowerCase()))&&(!t||m.tipo===t));
  if(f.length===0){tbody.innerHTML=`<tr><td colspan="12" class="no-records">Sin registros.</td></tr>`;return;}
  tbody.innerHTML=f.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.supervisor||'–')}</td><td>${esc(m.codInterno||'–')}</td>
    <td>${m.fecha||'–'}</td><td>${m.tipo||'–'}</td><td>${m.kmAnterior||'–'}</td><td>${m.kmActual||'–'}</td>
    <td>${m.kmRecorrido||'–'}</td><td>${m.kmProxMant||'–'}</td>
    <td>${m.estadoKm||'–'}</td><td>${esc(m.observaciones||'–')}</td>
    <td><button class="unid-btn unid-btn-danger" style="padding:5px 9px;font-size:11px;" onclick="uEliminarMant('${m.id}')">🗑</button></td></tr>`).join('');
}

function uRenderTablaLic() {
  const tbody=document.getElementById('uTbodyLic');if(!tbody)return;
  const q=(document.getElementById('uFiltLUser')||{}).value||'';
  const est=(document.getElementById('uFiltLEst')||{}).value||'';
  const f=licenciasData.filter(l=>(!q||String(l.usuario||'').toLowerCase().includes(q.toLowerCase()))&&(!est||l.estado===est));
  if(f.length===0){tbody.innerHTML=`<tr><td colspan="11" class="no-records">Sin registros.</td></tr>`;return;}
  const colorEst={vigente:'#16a34a',por_vencer:'#d97706',riesgo:'#ea580c',critico:'#dc2626',vencido:'#991b1b'};
  tbody.innerHTML=f.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.usuario||'–')}</td><td>${l.dni||'–'}</td>
    <td>${esc(l.codInterno||'–')}</td><td>${esc(l.numLicencia||'–')}</td><td>${l.tipo||'–'}</td>
    <td>${l.fechaExpedicion||'–'}</td><td>${l.vencimiento||'–'}</td>
    <td>${l.diasRestantes>=0?l.diasRestantes+' días':'VENCIDA'}</td>
    <td><span style="font-weight:700;color:${colorEst[l.estado]||'#64748b'}">${l.estado||'–'}</span></td>
    <td><button class="unid-btn unid-btn-danger" style="padding:5px 9px;font-size:11px;" onclick="uEliminarLic('${l.id}')">🗑</button></td></tr>`).join('');
}

function uAbrirModal(id) {
  const u=unidadesData.find(x=>x.id===id);if(!u)return;
  const s=i=>document.getElementById(i);
  document.getElementById('uModalId').value=id;
  s('uMoDni').value=u.dni||'';s('uMoUser').value=u.usuario||'';s('uMoCargo').value=u.cargo||'';
  s('uMoCodInt').value=u.codInterno||'';s('uMoCodSist').value=u.codSistema||'';
  s('uMoModelo').value=u.modelo||'';s('uMoMarca').value=u.marca||'';
  s('uMoMotor').value=u.motor||'';s('uMoChasis').value=u.chasis||'';
  s('uMoAnio').value=u.anio||'';s('uMoEstatus').value=u.estatus||'Operativo';
  s('uMoZonaRec').value=u.zonaRecorrido||'';s('uMoEmpresa').value=u.empresa||'VERFRUT';
  s('uMoZonaAbast').value=u.zonaAbastecimiento||'';
  document.getElementById('uModalOverlay').style.display='flex';
}

async function uGuardarModal() {
  const id=document.getElementById('uModalId').value;if(!id)return;
  const s=i=>document.getElementById(i).value;
  try {
    await updateDoc(doc(db,'unidades',id),{
      codInterno:s('uMoCodInt'),codSistema:s('uMoCodSist'),modelo:s('uMoModelo'),marca:s('uMoMarca'),
      motor:s('uMoMotor'),chasis:s('uMoChasis'),anio:parseInt(s('uMoAnio'))||null,
      estatus:s('uMoEstatus'),zonaRecorrido:s('uMoZonaRec'),empresa:s('uMoEmpresa'),
      zonaAbastecimiento:s('uMoZonaAbast')
    });
    document.getElementById('uModalOverlay').style.display='none';
    showToast('✏️ Unidad actualizada.');
  } catch(e){showToast('❌ Error al actualizar.',true);}
}

async function uEliminarMant(id) {
  if(!confirm('¿Eliminar mantenimiento?'))return;
  try{await deleteDoc(doc(db,'mantenimientos',id));showToast('🗑 Eliminado.');}catch(e){showToast('❌ Error.',true);}
}
async function uEliminarLic(id) {
  if(!confirm('¿Eliminar licencia?'))return;
  try{await deleteDoc(doc(db,'licencias',id));showToast('🗑 Eliminado.');}catch(e){showToast('❌ Error.',true);}
}

function uExportarUnidades() {
  if(unidadesData.length===0){showToast('Sin datos.',true);return;}
  const data=unidadesData.map(u=>({'DNI':u.dni,'Usuario':u.usuario,'Cargo':u.cargo,'Modelo':u.modelo,'Marca':u.marca,'Cód. Interno':u.codInterno,'Estatus':u.estatus,'Empresa':u.empresa}));
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Unidades');XLSX.writeFile(wb,'Unidades_ETI.xlsx');showToast('📥 Excel exportado.');
}
function uExportarMant() {
  if(mantenimientosData.length===0){showToast('Sin datos.',true);return;}
  const data=mantenimientosData.map(m=>({'Supervisor':m.supervisor,'Cód.':m.codInterno,'Fecha':m.fecha,'Tipo':m.tipo,'KM Ant.':m.kmAnterior,'KM Act.':m.kmActual,'Próx. KM':m.kmProxMant}));
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Mantenimientos');XLSX.writeFile(wb,'Mantenimientos_ETI.xlsx');showToast('📥 Excel exportado.');
}
function uExportarLic() {
  if(licenciasData.length===0){showToast('Sin datos.',true);return;}
  const data=licenciasData.map(l=>({'Usuario':l.usuario,'DNI':l.dni,'Nº Licencia':l.numLicencia,'Tipo':l.tipo,'Vencimiento':l.vencimiento,'Días Rest.':l.diasRestantes,'Estado':l.estado}));
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Licencias');XLSX.writeFile(wb,'Licencias_ETI.xlsx');showToast('📥 Excel exportado.');
}

// ─── MÓDULO GERENCIAL / EVALUACIONES 360° ─────────────────────
const G_CRITERIOS=[
  {id:'puntualidad',label:'⏰ Puntualidad y Asistencia'},
  {id:'campo',label:'🌾 Presencia en Campo'},
  {id:'reportes',label:'📋 Entrega de Reportes'},
  {id:'comunicacion',label:'💬 Comunicación con el Equipo'},
  {id:'seguridad',label:'🦺 Cumplimiento de Seguridad'},
  {id:'liderazgo',label:'👑 Liderazgo y Gestión'},
  {id:'logros',label:'📈 Cumplimiento de Metas'}
];
let supervisoresGH=[], evaluacionesData=[], seguimientosData=[];
let unsubSupsGH=null, unsubEvals=null, unsubSegs=null;

function initGerencial() {
  // Firebase listeners
  unsubSupsGH = onSnapshot(query(collection(db,'supervisores_gh'),orderBy('nombre','asc')), snap=>{
    supervisoresGH=snap.docs.map(d=>({id:d.id,...d.data()}));
    gPoblarSelects();gRenderSupervisores();
  }, e=>console.error('supervisores_gh:',e));
  unsubEvals = onSnapshot(query(collection(db,'evaluaciones'),orderBy('creadoEn','desc')), snap=>{
    evaluacionesData=snap.docs.map(d=>({id:d.id,...d.data()}));
    gRenderDashboard();gRenderTablaEvals();gRenderRanking();
  }, e=>console.error('evaluaciones:',e));
  unsubSegs = onSnapshot(query(collection(db,'seguimientos'),orderBy('fecha','desc')), snap=>{
    seguimientosData=snap.docs.map(d=>({id:d.id,...d.data()}));
    gRenderDashboard();gRenderTablaSegs();
  }, e=>console.error('seguimientos:',e));
  gInitRatingUI();
  gInitButtons();
}

function gInitRatingUI() {
  const cont=document.getElementById('gRatingGroup');if(!cont)return;
  cont.innerHTML=G_CRITERIOS.map(c=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:12px;font-weight:600;color:#374151;">${c.label}</span>
      <div style="display:flex;gap:4px;">
        ${[1,2,3,4,5].map(n=>`<label style="cursor:pointer;">
          <input type="radio" name="gCrit_${c.id}" value="${n}" style="display:none;" onchange="gCalcPuntaje()"/>
          <span class="gStar_${c.id}_${n}" style="font-size:20px;opacity:.3;" title="${n}">⭐</span>
        </label>`).join('')}
      </div>
    </div>`).join('');
  // Star highlight on hover/change
  cont.querySelectorAll('input[type=radio]').forEach(inp=>{
    inp.addEventListener('change',()=>{
      const [,id]=inp.name.split('gCrit_');
      for(let i=1;i<=5;i++) {
        const sp=cont.querySelector(`.gStar_${id}_${i}`);
        if(sp) sp.style.opacity = i<=parseInt(inp.value)?'1':'.3';
      }
    });
  });
}

function gCalcPuntaje() {
  let suma=0,count=0;
  G_CRITERIOS.forEach(c=>{
    const sel=document.querySelector(`input[name="gCrit_${c.id}"]:checked`);
    if(sel){suma+=parseInt(sel.value);count++;}
  });
  const max=G_CRITERIOS.length*5;
  const pct=count>0?Math.round((suma/max)*100):0;
  document.getElementById('gEvPuntaje').textContent=pct+'%';
  let nivel='–',color='#64748b';
  if(pct>=90){nivel='🏆 Excelente';color='#16a34a';}
  else if(pct>=75){nivel='👍 Bueno';color='#0050c8';}
  else if(pct>=60){nivel='⚠️ Regular';color='#d97706';}
  else if(pct>0){nivel='🚨 Crítico';color='#dc2626';}
  const nEl=document.getElementById('gEvNivel');
  nEl.textContent=nivel;nEl.style.color=color;
}

function gPoblarSelects() {
  const opts=supervisoresGH.filter(s=>s.estado!=='inactivo').map(s=>`<option value="${s.id}">${esc(s.nombre)}</option>`).join('');
  ['gEvSup','gSegSup','gInfSup'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.innerHTML='<option value="">— Seleccionar —</option>'+opts;}
  });
  ['gFiltEvSup','gFiltSegSup'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.innerHTML='<option value="">Todos los supervisores</option>'+supervisoresGH.map(s=>`<option value="${s.id}">${esc(s.nombre)}</option>`).join('');}
  });
  // Wire sup selects to autofill
  const wire=(supId,empId,secId,admId)=>{
    const el=document.getElementById(supId);if(!el)return;
    el.addEventListener('change',function(){
      const sup=supervisoresGH.find(s=>s.id===this.value)||{};
      if(empId){const e=document.getElementById(empId);if(e)e.value=sup.empresa||'';}
      if(secId){const e=document.getElementById(secId);if(e)e.value=sup.sector||'';}
      if(admId){const e=document.getElementById(admId);if(e)e.value=sup.admin||'';}
    });
  };
  wire('gEvSup','gEvEmpresa','gEvSector','gEvAdmin');
  wire('gSegSup','gSegEmpresa','gSegSector',null);
  wire('gInfSup','gInfEmpresa','gInfSector',null);
}

function gInitButtons() {
  const s=id=>document.getElementById(id);
  if(s('gBtnSaveEval')) s('gBtnSaveEval').addEventListener('click',gGuardarEvaluacion);
  if(s('gBtnClearEval')) s('gBtnClearEval').addEventListener('click',gLimpiarEval);
  if(s('gBtnSaveSeg')) s('gBtnSaveSeg').addEventListener('click',gGuardarSeguimiento);
  if(s('gBtnClearSeg')) s('gBtnClearSeg').addEventListener('click',gLimpiarSeg);
  if(s('gBtnNuevoSup')) s('gBtnNuevoSup').addEventListener('click',()=>gAbrirModalSup(null));
  if(s('gBtnExpEvals')) s('gBtnExpEvals').addEventListener('click',gExportarEvals);
  if(s('gBtnExpSegs')) s('gBtnExpSegs').addEventListener('click',gExportarSegs);
  if(s('gBtnGenInf')) s('gBtnGenInf').addEventListener('click',gGenerarInforme);
  if(s('gFiltEvSup')) s('gFiltEvSup').addEventListener('change',gRenderTablaEvals);
  if(s('gFiltEvTipo')) s('gFiltEvTipo').addEventListener('change',gRenderTablaEvals);
  if(s('gFiltSegSup')) s('gFiltSegSup').addEventListener('change',gRenderTablaSegs);
}

async function gGuardarEvaluacion() {
  const supId=document.getElementById('gEvSup').value;
  const tipo=document.getElementById('gEvTipo').value;
  const fecha=document.getElementById('gEvFecha').value;
  if(!supId||!tipo||!fecha){showToast('Completa Supervisor, Tipo y Fecha (*)',true);return;}
  const sup=supervisoresGH.find(s=>s.id===supId)||{};
  const criterios={};
  G_CRITERIOS.forEach(c=>{
    const sel=document.querySelector(`input[name="gCrit_${c.id}"]:checked`);
    criterios[c.id]=sel?parseInt(sel.value):0;
  });
  const max=G_CRITERIOS.length*5;
  const suma=Object.values(criterios).reduce((a,b)=>a+b,0);
  const pct=Math.round((suma/max)*100);
  let nivel='Crítico';
  if(pct>=90)nivel='Excelente';else if(pct>=75)nivel='Bueno';else if(pct>=60)nivel='Regular';
  try {
    await addDoc(collection(db,'evaluaciones'),{
      supervisorId:supId,supervisor:sup.nombre||'',empresa:sup.empresa||'',
      sector:sup.sector||'',tipo,periodo:document.getElementById('gEvPeriodo').value||'',
      fecha,evaluador:document.getElementById('gEvEvaluador').value.trim(),
      criterios,puntaje:pct,nivel,
      fortalezas:document.getElementById('gEvFortalezas').value.trim(),
      mejoras:document.getElementById('gEvMejoras').value.trim(),
      recomendaciones:document.getElementById('gEvRecomendaciones').value.trim(),
      creadoEn:new Date().toISOString()
    });
    showToast('✅ Evaluación guardada.');gLimpiarEval();
  } catch(e){showToast('❌ Error al guardar.',true);}
}

function gLimpiarEval() {
  ['gEvSup','gEvTipo','gEvPeriodo','gEvFecha'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['gEvEmpresa','gEvSector','gEvAdmin','gEvEvaluador','gEvFortalezas','gEvMejoras','gEvRecomendaciones'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('gEvPuntaje').textContent='0%';
  document.getElementById('gEvNivel').textContent='–';
  G_CRITERIOS.forEach(c=>{
    document.querySelectorAll(`input[name="gCrit_${c.id}"]`).forEach(r=>r.checked=false);
    for(let i=1;i<=5;i++){const sp=document.querySelector(`.gStar_${c.id}_${i}`);if(sp)sp.style.opacity='.3';}
  });
}

async function gGuardarSeguimiento() {
  const supId=document.getElementById('gSegSup').value;
  const fecha=document.getElementById('gSegFecha').value;
  if(!supId||!fecha){showToast('Completa Supervisor y Fecha (*)',true);return;}
  const sup=supervisoresGH.find(s=>s.id===supId)||{};
  try {
    await addDoc(collection(db,'seguimientos'),{
      supervisorId:supId,supervisor:sup.nombre||'',empresa:sup.empresa||'',sector:sup.sector||'',
      fecha,tipo:document.getElementById('gSegTipo').value,
      presencia:document.getElementById('gSegPresencia').value,
      meta:parseInt(document.getElementById('gSegMeta').value)||0,
      avance:parseInt(document.getElementById('gSegAvance').value)||0,
      actividades:document.getElementById('gSegActividades').value.trim(),
      incidencias:document.getElementById('gSegIncidencias').value.trim(),
      creadoEn:new Date().toISOString()
    });
    showToast('✅ Seguimiento guardado.');gLimpiarSeg();
  } catch(e){showToast('❌ Error al guardar.',true);}
}

function gLimpiarSeg() {
  ['gSegSup','gSegFecha','gSegMeta','gSegAvance','gSegActividades','gSegIncidencias'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['gSegEmpresa','gSegSector'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

function gRenderDashboard() {
  // KPIs
  const sups=new Set(evaluacionesData.map(e=>e.supervisorId)).size;
  const promedios={};
  evaluacionesData.forEach(e=>{
    if(!promedios[e.supervisorId]){promedios[e.supervisorId]={suma:0,count:0,nombre:e.supervisor,empresa:e.empresa,sector:e.sector};}
    promedios[e.supervisorId].suma+=e.puntaje||0;
    promedios[e.supervisorId].count++;
  });
  let exc=0,bue=0,reg=0,crit=0;
  const ranking=Object.values(promedios).map(p=>{const avg=Math.round(p.suma/p.count);let nivel='Crítico';if(avg>=90){nivel='Excelente';exc++;}else if(avg>=75){nivel='Bueno';bue++;}else if(avg>=60){nivel='Regular';reg++;}else crit++;return{...p,avg,nivel};}).sort((a,b)=>b.avg-a.avg);
  const s=id=>document.getElementById(id);
  s('gkSups').textContent=supervisoresGH.length;
  s('gkExc').textContent=exc;s('gkBue').textContent=bue;
  s('gkReg').textContent=reg;s('gkCrit').textContent=crit;
  s('gkEvals').textContent=evaluacionesData.length;
  s('gkSegs').textContent=seguimientosData.length;
  // Criticos / Mejores
  const criticos=ranking.filter(r=>r.nivel==='Crítico').slice(0,5);
  const mejores=ranking.filter(r=>r.nivel==='Excelente'||r.nivel==='Bueno').slice(0,5);
  s('gDashCriticos').innerHTML=criticos.length===0?'<p class="ger-empty">Sin supervisores críticos.</p>'
    :criticos.map(r=>`<div style="padding:6px 0;border-bottom:1px solid #fee2e2;font-size:12px;"><span style="color:#dc2626;font-weight:700;">🚨 ${esc(r.nombre)}</span> – ${r.avg}%</div>`).join('');
  s('gDashMejores').innerHTML=mejores.length===0?'<p class="ger-empty">Sin datos suficientes.</p>'
    :mejores.map(r=>`<div style="padding:6px 0;border-bottom:1px solid #dcfce7;font-size:12px;"><span style="color:#16a34a;font-weight:700;">🏆 ${esc(r.nombre)}</span> – ${r.avg}%</div>`).join('');
  // Charts
  const dc=id=>{const c=Chart.getChart(id);if(c)c.destroy();};
  dc('gChartDistrib');
  new Chart(s('gChartDistrib'),{type:'doughnut',data:{labels:['Excelente','Bueno','Regular','Crítico'],datasets:[{data:[exc,bue,reg,crit],backgroundColor:['#16a34a','#0050c8','#d97706','#dc2626'],borderWidth:0}]},options:{responsive:true,cutout:'55%',plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
  const rapel=evaluacionesData.filter(e=>e.empresa==='RAPEL').length;
  const verfrut=evaluacionesData.filter(e=>e.empresa==='VERFRUT').length;
  dc('gChartEmpresas');
  new Chart(s('gChartEmpresas'),{type:'bar',data:{labels:['RAPEL','VERFRUT'],datasets:[{data:[rapel,verfrut],backgroundColor:['#3b82f6','#16a34a'],borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
  const mm={},mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  evaluacionesData.forEach(e=>{if(e.fecha){const mo=new Date(e.fecha+'T12:00:00').getMonth();mm[mo]=(mm[mo]||0)+1;}});
  const mk=Object.keys(mm).sort((a,b)=>a-b);
  dc('gChartTend');
  new Chart(s('gChartTend'),{type:'line',data:{labels:mk.map(k=>mn[k]),datasets:[{label:'Evaluaciones',data:mk.map(k=>mm[k]),borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,.1)',tension:.4,fill:true,pointRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}}}});
  const sec={};
  evaluacionesData.forEach(e=>{if(e.sector){if(!sec[e.sector])sec[e.sector]={suma:0,count:0};sec[e.sector].suma+=e.puntaje||0;sec[e.sector].count++;}});
  const secKeys=Object.keys(sec);const secAvg=secKeys.map(k=>Math.round(sec[k].suma/sec[k].count));
  dc('gChartSec');
  new Chart(s('gChartSec'),{type:'bar',data:{labels:secKeys.map(k=>k.replace('SECTOR ','').substring(0,10)),datasets:[{label:'% Promedio',data:secAvg,backgroundColor:'#ea580c',borderRadius:4}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:v=>v+'%'}}}}});
}

function gRenderTablaEvals() {
  const tbody=document.getElementById('gTbodyEvals');if(!tbody)return;
  const supF=(document.getElementById('gFiltEvSup')||{}).value||'';
  const tipF=(document.getElementById('gFiltEvTipo')||{}).value||'';
  const f=evaluacionesData.filter(e=>(!supF||e.supervisorId===supF)&&(!tipF||e.tipo===tipF));
  if(f.length===0){tbody.innerHTML=`<tr><td colspan="11" class="ger-empty">Sin evaluaciones.</td></tr>`;return;}
  const colorNivel={Excelente:'#16a34a',Bueno:'#0050c8',Regular:'#d97706',Crítico:'#dc2626'};
  tbody.innerHTML=f.map((e,i)=>`<tr><td>${i+1}</td><td><strong>${esc(e.supervisor||'')}</strong></td>
    <td>${esc(e.empresa||'')}</td><td>${esc(e.sector||'')}</td><td>${e.tipo||''}</td>
    <td>${e.periodo||'–'}</td><td>${e.fecha||''}</td>
    <td><strong style="color:#7c3aed">${e.puntaje||0}%</strong></td>
    <td><span style="font-weight:700;color:${colorNivel[e.nivel]||'#64748b'}">${e.nivel||'–'}</span></td>
    <td>${esc(e.evaluador||'–')}</td>
    <td><button class="ger-btn ger-btn-danger ger-btn-sm" onclick="gEliminarEval('${e.id}')">🗑</button></td></tr>`).join('');
}

function gRenderTablaSegs() {
  const tbody=document.getElementById('gTbodySegs');if(!tbody)return;
  const supF=(document.getElementById('gFiltSegSup')||{}).value||'';
  const f=seguimientosData.filter(s=>!supF||s.supervisorId===supF);
  if(f.length===0){tbody.innerHTML=`<tr><td colspan="11" class="ger-empty">Sin seguimientos.</td></tr>`;return;}
  tbody.innerHTML=f.map((s,i)=>`<tr><td>${i+1}</td><td><strong>${esc(s.supervisor||'')}</strong></td>
    <td>${esc(s.empresa||'')}</td><td>${esc(s.sector||'')}</td><td>${s.fecha||''}</td>
    <td>${s.tipo||''}</td><td>${s.presencia||''}</td>
    <td>${s.meta||0}%</td><td>${s.avance||0}%</td>
    <td title="${esc(s.actividades||'')}">${(s.actividades||'–').substring(0,40)}…</td>
    <td><button class="ger-btn ger-btn-danger ger-btn-sm" onclick="gEliminarSeg('${s.id}')">🗑</button></td></tr>`).join('');
}

function gRenderRanking() {
  const tbody=document.getElementById('gTbodyRanking');if(!tbody)return;
  const promedios={};
  evaluacionesData.forEach(e=>{
    if(!promedios[e.supervisorId])promedios[e.supervisorId]={nombre:e.supervisor,empresa:e.empresa,sector:e.sector,evals:0,sumaPct:0,sumaCampo:0,sumaAdmin:0,sumaComun:0};
    promedios[e.supervisorId].evals++;
    promedios[e.supervisorId].sumaPct+=e.puntaje||0;
    promedios[e.supervisorId].sumaCampo+=e.criterios?.campo||0;
    promedios[e.supervisorId].sumaAdmin+=e.criterios?.reportes||0;
    promedios[e.supervisorId].sumaComun+=e.criterios?.comunicacion||0;
  });
  if(Object.keys(promedios).length===0){tbody.innerHTML=`<tr><td colspan="11" class="ger-empty">Sin evaluaciones.</td></tr>`;return;}
  const rank=Object.values(promedios).map(p=>({...p,avg:Math.round(p.sumaPct/p.evals)})).sort((a,b)=>b.avg-a.avg);
  const colorNivel=avg=>avg>=90?'#16a34a':avg>=75?'#0050c8':avg>=60?'#d97706':'#dc2626';
  tbody.innerHTML=rank.map((r,i)=>{
    const nivel=r.avg>=90?'Excelente':r.avg>=75?'Bueno':r.avg>=60?'Regular':'Crítico';
    const tend=i<rank.length-1&&r.avg>rank[i+1]?.avg?'📈':i>0&&r.avg<rank[i-1]?.avg?'📉':'➡️';
    return `<tr><td><strong>#${i+1}</strong></td><td>${esc(r.nombre)}</td><td>${esc(r.empresa)}</td>
      <td>${esc(r.sector)}</td><td>${r.evals}</td>
      <td><strong style="color:${colorNivel(r.avg)}">${r.avg}%</strong></td>
      <td>${r.evals>0?Math.round(r.sumaCampo/r.evals*20)+'%':'–'}</td>
      <td>${r.evals>0?Math.round(r.sumaAdmin/r.evals*20)+'%':'–'}</td>
      <td>${r.evals>0?Math.round(r.sumaComun/r.evals*20)+'%':'–'}</td>
      <td><span style="font-weight:700;color:${colorNivel(r.avg)}">${nivel}</span></td>
      <td>${tend}</td></tr>`;
  }).join('');
  // Panel rankings
  ['gRankGeneral','gRankRapel','gRankVerfrut'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const f=id==='gRankRapel'?rank.filter(r=>r.empresa==='RAPEL'):id==='gRankVerfrut'?rank.filter(r=>r.empresa==='VERFRUT'):rank;
    el.innerHTML=f.slice(0,5).map((r,i)=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
      <span>${['🥇','🥈','🥉'][i]||'#'+(i+1)} ${esc(r.nombre)}</span>
      <strong style="color:${colorNivel(r.avg)}">${r.avg}%</strong></div>`).join('')||'<p class="ger-empty">Sin datos.</p>';
  });
}

function gRenderSupervisores() {
  const lista=document.getElementById('gListaSups');if(!lista)return;
  if(supervisoresGH.length===0){lista.innerHTML='<p class="ger-empty">Sin supervisores registrados.</p>';return;}
  lista.innerHTML=supervisoresGH.map(s=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bd);flex-wrap:wrap;gap:8px;">
      <div>
        <div style="font-weight:700;font-size:13px;">${esc(s.nombre)}</div>
        <div style="font-size:11px;color:#64748b;">${s.empresa||''} · ${s.sector||''} · ${s.cargo||''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;background:${s.estado==='inactivo'?'#fee2e2':'#dcfce7'};color:${s.estado==='inactivo'?'#dc2626':'#16a34a'}">${s.estado==='inactivo'?'⛔ Inactivo':'✅ Activo'}</span>
        <button class="ger-btn ger-btn-morado ger-btn-sm" onclick="gAbrirModalSup('${s.id}')">✏️ Editar</button>
      </div>
    </div>`).join('');
}

function gGenerarInforme() {
  const supId=document.getElementById('gInfSup').value;
  const periodo=document.getElementById('gInfPeriodo').value;
  if(!supId){showToast('Selecciona un supervisor.',true);return;}
  const sup=supervisoresGH.find(s=>s.id===supId)||{};
  const evals=evaluacionesData.filter(e=>e.supervisorId===supId&&(!periodo||e.periodo===periodo));
  const segs=seguimientosData.filter(s=>s.supervisorId===supId);
  const avg=evals.length>0?Math.round(evals.reduce((a,e)=>a+(e.puntaje||0),0)/evals.length):0;
  const nivel=avg>=90?'Excelente':avg>=75?'Bueno':avg>=60?'Regular':'Crítico';
  const panel=document.getElementById('gInformePanel');
  const cont=document.getElementById('gInformeContent');
  cont.innerHTML=`<h2 style="color:var(--azul);margin-bottom:8px;">Informe de Desempeño – ${esc(sup.nombre)}</h2>
    <p style="color:#64748b;margin-bottom:16px;">${sup.empresa||''} · ${sup.sector||''} · ${periodo||'Todos los periodos'}</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:24px;font-weight:800;color:var(--azul)">${evals.length}</div><div style="font-size:11px;color:#64748b;">Evaluaciones</div></div>
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:24px;font-weight:800;color:#7c3aed">${avg}%</div><div style="font-size:11px;color:#64748b;">Promedio</div></div>
      <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:24px;font-weight:800;color:${avg>=75?'#16a34a':'#dc2626'}">${nivel}</div><div style="font-size:11px;color:#64748b;">Nivel</div></div>
    </div>
    ${evals.length>0?`<h3 style="margin-bottom:8px;font-size:13px;color:#374151;">Evaluaciones recientes</h3>
    ${evals.slice(0,5).map(e=>`<div style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px;"><strong>${e.tipo}</strong> ${e.fecha} – ${e.puntaje}% (${e.nivel})</div>`).join('')}`:'<p style="color:#64748b;font-size:13px;">Sin evaluaciones para este periodo.</p>'}`;
  panel.style.display='block';
}

async function gEliminarEval(id) {
  if(!confirm('¿Eliminar evaluación?'))return;
  try{await deleteDoc(doc(db,'evaluaciones',id));showToast('🗑 Evaluación eliminada.');}catch(e){showToast('❌ Error.',true);}
}
async function gEliminarSeg(id) {
  if(!confirm('¿Eliminar seguimiento?'))return;
  try{await deleteDoc(doc(db,'seguimientos',id));showToast('🗑 Seguimiento eliminado.');}catch(e){showToast('❌ Error.',true);}
}

// Modales de supervisor
function gAbrirModalRapido(origen) {
  document.getElementById('gMrOrigen').value=origen;
  ['gMrNombre','gMrSector','gMrAdmin'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const emp=document.getElementById('gMrEmpresa');if(emp)emp.value='';
  const cargo=document.getElementById('gMrCargo');if(cargo)cargo.value='SUPERVISOR(A) DE GESTION HUMANA';
  document.getElementById('gModalRapido').style.display='flex';
}
function gCerrarModalRapido() { document.getElementById('gModalRapido').style.display='none'; }
async function gGuardarRapido() {
  const nombre=document.getElementById('gMrNombre').value.trim().toUpperCase();
  const empresa=document.getElementById('gMrEmpresa').value;
  const sector=document.getElementById('gMrSector').value.trim();
  const admin=document.getElementById('gMrAdmin').value.trim();
  const cargo=document.getElementById('gMrCargo').value.trim()||'SUPERVISOR(A) DE GESTION HUMANA';
  if(!nombre||!empresa||!sector){showToast('Completa Nombre, Empresa y Sector.',true);return;}
  try {
    const ref=await addDoc(collection(db,'supervisores_gh'),{nombre,empresa,sector,admin,cargo,estado:'activo',creadoEn:new Date().toISOString()});
    showToast('✅ Supervisor agregado.');
    gCerrarModalRapido();
  } catch(e){showToast('❌ Error al guardar.',true);}
}
function gAbrirModalSup(id) {
  const titulo=document.getElementById('gModalSupTitulo');
  const msId=document.getElementById('gMsId');
  if(!id){
    if(titulo)titulo.textContent='➕ Nuevo Supervisor';
    if(msId)msId.value='';
    ['gMsNombre','gMsSector','gMsAdmin'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
    const emp=document.getElementById('gMsEmpresa');if(emp)emp.value='RAPEL';
    const est=document.getElementById('gMsEstado');if(est)est.value='activo';
    const cargo=document.getElementById('gMsCargo');if(cargo)cargo.value='SUPERVISOR(A) DE GESTION HUMANA';
  } else {
    const sup=supervisoresGH.find(s=>s.id===id);if(!sup)return;
    if(titulo)titulo.textContent='✏️ Editar Supervisor';
    if(msId)msId.value=id;
    document.getElementById('gMsNombre').value=sup.nombre||'';
    document.getElementById('gMsEmpresa').value=sup.empresa||'RAPEL';
    document.getElementById('gMsSector').value=sup.sector||'';
    document.getElementById('gMsAdmin').value=sup.admin||'';
    document.getElementById('gMsCargo').value=sup.cargo||'SUPERVISOR(A) DE GESTION HUMANA';
    document.getElementById('gMsEstado').value=sup.estado||'activo';
  }
  document.getElementById('gModalSup').style.display='flex';
}
function gCerrarModal() { document.getElementById('gModalSup').style.display='none'; }
async function gGuardarSupervisor() {
  const id=document.getElementById('gMsId').value;
  const nombre=document.getElementById('gMsNombre').value.trim().toUpperCase();
  const empresa=document.getElementById('gMsEmpresa').value;
  const sector=document.getElementById('gMsSector').value.trim();
  const admin=document.getElementById('gMsAdmin').value.trim();
  const cargo=document.getElementById('gMsCargo').value.trim()||'SUPERVISOR(A) DE GESTION HUMANA';
  const estado=document.getElementById('gMsEstado').value;
  if(!nombre||!empresa||!sector){showToast('Completa Nombre, Empresa y Sector.',true);return;}
  try {
    if(id) {
      await updateDoc(doc(db,'supervisores_gh',id),{nombre,empresa,sector,admin,cargo,estado});
      showToast('✏️ Supervisor actualizado.');
    } else {
      await addDoc(collection(db,'supervisores_gh'),{nombre,empresa,sector,admin,cargo,estado:'activo',creadoEn:new Date().toISOString()});
      showToast('✅ Supervisor creado.');
    }
    gCerrarModal();
  } catch(e){showToast('❌ Error al guardar.',true);}
}

function gExportarEvals() {
  if(evaluacionesData.length===0){showToast('Sin datos.',true);return;}
  const data=evaluacionesData.map(e=>({'Supervisor':e.supervisor,'Empresa':e.empresa,'Sector':e.sector,'Tipo':e.tipo,'Periodo':e.periodo,'Fecha':e.fecha,'Puntaje':e.puntaje+'%','Nivel':e.nivel,'Evaluador':e.evaluador}));
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Evaluaciones');XLSX.writeFile(wb,'Evaluaciones360_ETI.xlsx');showToast('📥 Excel exportado.');
}
function gExportarSegs() {
  if(seguimientosData.length===0){showToast('Sin datos.',true);return;}
  const data=seguimientosData.map(s=>({'Supervisor':s.supervisor,'Empresa':s.empresa,'Sector':s.sector,'Fecha':s.fecha,'Tipo':s.tipo,'Presencia':s.presencia,'Meta':s.meta+'%','Avance':s.avance+'%'}));
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Seguimientos');XLSX.writeFile(wb,'Seguimientos_ETI.xlsx');showToast('📥 Excel exportado.');
}

// ─── UTILS ────────────────────────────────────────────────────
function formatDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function formatDateDisplay(str){
  if(!str)return'–';
  const[y,m,d]=str.split('-');
  const mn=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d}/${mn[parseInt(m)-1]}/${y}`;
}
function esc(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg,isError=false,isWarning=false){
  const e=document.querySelector('.toast');if(e)e.remove();
  const t=document.createElement('div');
  t.className='toast'+(isError?' error':isWarning?' warning':'');
  t.innerHTML=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},4500);
}
window.abrirModal=abrirModal;
window.eliminarRegistro=eliminarRegistro;
window.uAbrirModal=uAbrirModal;
window.uGuardarModal=uGuardarModal;
window.uEliminarMant=uEliminarMant;
window.uEliminarLic=uEliminarLic;
window.gAbrirModalRapido=gAbrirModalRapido;
window.gCerrarModalRapido=gCerrarModalRapido;
window.gGuardarRapido=gGuardarRapido;
window.gAbrirModalSup=gAbrirModalSup;
window.gCerrarModal=gCerrarModal;
window.gGuardarSupervisor=gGuardarSupervisor;
window.gEliminarEval=gEliminarEval;
window.gEliminarSeg=gEliminarSeg;
window.gCalcPuntaje=gCalcPuntaje;
