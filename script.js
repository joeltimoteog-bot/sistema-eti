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
  // Escuchar cambios en tiempo real desde Firebase
  escucharFirebase();
}

function cerrarSesion() {
  if(unsubscribe) unsubscribe();
  usuarioActual=null;
  registros=[];
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
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target=btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+target).classList.add('active');
      if(target==='dashboard') renderDashboard();
      if(target==='tabla') renderTabla();
      if(target==='ranking') renderRanking();
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
  new Chart(document.getElementById('chartTemporada'),{type:'pie',data:{labels:['Temporada Alta','Temporada Baja'],datasets:[{data:[alta,registros.length-alta],backgroundColor:['#e8b94a','#0050c8'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:11}}}}}});
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
