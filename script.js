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
      if(target==='estadisticas') renderEstadisticas();
      if(target==='unidades') uRenderDashboard();
    });
  });
}

// ─── TEMPORADA ────────────────────────────────────────────────
// ─── TEMPORADA ────────────────────────────────────────────────
// Baja: 5-ene al 26-jun → Lun-Vie
// Alta: 27-jun al 31-dic → Lun-Sáb
function detectarTemporada(fecha) {
  const d=typeof fecha==='string'?new Date(fecha+'T12:00:00'):new Date(fecha);
  const val=(d.getMonth()+1)*100+d.getDate();
  // Baja: 01-05 (105) hasta 06-26 (626)
  return (val>=105&&val<=626)?'baja':'alta';
}
function esFestivo(fecha) {
  const mm=String(fecha.getMonth()+1).padStart(2,'0');
  const dd=String(fecha.getDate()).padStart(2,'0');
  return FESTIVOS_PERU.includes(mm+'-'+dd);
}
function esDiaHabil(fecha,temporada) {
  const dow=fecha.getDay(); // 0=Dom,1=Lun,...,6=Sáb
  if(dow===0) return false;                          // Domingo: nunca hábil
  if(temporada==='baja'&&dow===6) return false;      // Sáb en temporada baja: no hábil
  if(esFestivo(fecha)) return false;                 // Festivo: no hábil
  return true;
}

// Paso 1: Calcular fecha límite
// Regla: El día de ejecución NO cuenta. Se suman 3 días hábiles desde el día SIGUIENTE.
// La temporada se determina según la fecha de ejecución.
function calcularFechaLimite(fechaEjecStr) {
  const temporada=detectarTemporada(fechaEjecStr);
  let d=new Date(fechaEjecStr+'T12:00:00');
  let habiles=0;
  // Avanzar día por día desde el día SIGUIENTE a la ejecución
  while(habiles<3){
    d.setDate(d.getDate()+1);
    if(esDiaHabil(d,temporada)) habiles++;
  }
  return {fechaLimite:formatDate(d),temporada};
}

// Contar días hábiles entre dos fechas (excluyendo 'desde', incluyendo 'hasta')
// La temporada se detecta DÍA A DÍA para manejar cambios de temporada dentro del rango
function contarDiasHabiles(desde,hasta) {
  let count=0;
  let d=new Date(desde.getTime());
  d.setDate(d.getDate()+1); // Empezar desde el día SIGUIENTE
  while(d<=hasta){
    const temp=detectarTemporada(d); // Detectar temporada de cada día
    if(esDiaHabil(d,temp)) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}

// ─── ESTADO ───────────────────────────────────────────────────
// Lógica:
// A) Si tiene fecha de envío:
//    - fEnvio <= fLimite → CUMPLIDO (avance 100%, retraso 0%)
//    - fEnvio > fLimite  → RETRASO (días hábiles entre fLimite y fEnvio)
// B) Sin fecha de envío (pendiente):
//    - hoy <= fLimite → EN PROCESO (avance = días hábiles transcurridos desde ejecución / 3)
//    - hoy > fLimite  → RETRASO (días hábiles entre fLimite y hoy)
// Porcentajes: plazo total = 3 días hábiles
//    avance%  = diasTranscurridos/3 * 100
//    retraso% = diasRetraso/3 * 100 (puede superar 100%)
function calcularEstado(reg) {
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const fLimite=new Date(reg.fechaLimite+'T12:00:00');
  const fEjec=new Date(reg.fechaEjecucion+'T12:00:00');
  const fEnvio=reg.fechaEnvio?new Date(reg.fechaEnvio+'T12:00:00'):null;

  if(fEnvio) {
    // Caso A: Ya se envió
    if(fEnvio<=fLimite) {
      return {estado:'cumplido',avance:100,retraso:0,diasRetraso:0};
    }
    // Retraso: días hábiles entre fecha límite y fecha de envío
    const dr=contarDiasHabiles(fLimite,fEnvio);
    const pctRetraso=Math.round((dr/3)*100);
    return {
      estado: dr<=2?'leve':'critico',
      avance: 0,
      retraso: Math.min(pctRetraso,100),
      diasRetraso: dr
    };
  }

  // Caso B: Aún no se envía
  if(hoy<=fLimite) {
    // En proceso: calcular avance según días hábiles transcurridos desde ejecución
    const duTranscurridos=contarDiasHabiles(fEjec,hoy);
    const pctAvance=Math.min(Math.round((duTranscurridos/3)*100),99);
    return {estado:'proceso',avance:pctAvance,retraso:0,diasRetraso:0};
  }

  // Retraso sin envío: días hábiles entre fecha límite y hoy
  const dr=contarDiasHabiles(fLimite,hoy);
  const pctRetraso=Math.round((dr/3)*100);
  return {
    estado: dr<=2?'leve':'critico',
    avance: 0,
    retraso: Math.min(pctRetraso,100),
    diasRetraso: dr
  };
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
  // Mostrar bloque tipo personal cuando se selecciona un tema
  document.getElementById('fTema').addEventListener('change',function(){
    const bloquePersonal=document.getElementById('bloquePersonal');
    const bloqueRutas=document.getElementById('bloqueRutas');
    const bloqueAreas=document.getElementById('bloqueAreas');
    if(this.value){
      bloquePersonal.style.display='block';
    } else {
      bloquePersonal.style.display='none';
      bloqueRutas.style.display='block';
      bloqueAreas.style.display='none';
      document.querySelectorAll('input[name="tipoPersonal"]').forEach(r=>r.checked=false);
    }
    verificarRetrasoForm();
  });
  // Mostrar rutas u áreas según tipo de personal
  document.querySelectorAll('input[name="tipoPersonal"]').forEach(r=>{
    r.addEventListener('change',function(){
      const bloqueRutas=document.getElementById('bloqueRutas');
      const bloqueAreas=document.getElementById('bloqueAreas');
      if(this.value==='OBREROS'){
        bloqueRutas.style.display='block';
        bloqueAreas.style.display='none';
        document.getElementById('areasItemsCont').innerHTML='';
        document.getElementById('fCantAreas').value='';
      } else {
        bloqueRutas.style.display='none';
        bloqueAreas.style.display='block';
        // Limpiar rutas
        document.querySelectorAll('input[name="tipoRutas"]').forEach(x=>x.checked=false);
        document.getElementById('rutasNumeroCont').style.display='none';
        document.getElementById('rutasVariasCont').style.display='none';
        document.getElementById('rutasItemsCont').innerHTML='';
      }
    });
  });
  // Generar filas de áreas dinámicamente
  document.getElementById('fCantAreas').addEventListener('input',function(){
    generarFilasAreas(parseInt(this.value)||0);
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

function generarFilasAreas(cant){
  const cont=document.getElementById('areasItemsCont');
  if(cant<1||cant>50){cont.innerHTML='';return;}
  let html=`<div class="ruta-header"><span>#</span><span>Nombre del Área</span><span>N° Empleados</span></div>`;
  for(let i=1;i<=cant;i++){
    html+=`<div class="ruta-item-row">
      <div class="ruta-num">${i}</div>
      <input type="text" class="area-nombre" placeholder="Ej: Recursos Humanos" maxlength="80"/>
      <input type="number" class="area-cant" placeholder="Cant." min="0" style="max-width:80px"/>
    </div>`;
  }
  cont.innerHTML=html;
}

function obtenerAreas(){
  const areas=[];
  const nombres=document.querySelectorAll('.area-nombre');
  const cants=document.querySelectorAll('.area-cant');
  nombres.forEach((n,i)=>{
    if(n.value.trim()) areas.push({nombre:n.value.trim(),cantidad:parseInt(cants[i].value)||0});
  });
  return areas;
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
  // Tipo de personal (opcional para registros nuevos, requerido si se seleccionó tema)
  const tpEl=document.querySelector('input[name="tipoPersonal"]:checked');
  const tipoPersonal=tpEl?tpEl.value:'';
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
  const rutasData=tipoPersonal==='EMPLEADOS'?{tipo:'ninguna',rutas:[]}:obtenerRutas();
  const areasData=tipoPersonal==='EMPLEADOS'?obtenerAreas():[];
  const reg={
    supervisor,sector,varones:v,mujeres:m,total:v+m,
    tema,fechaEjecucion:fechaE,fechaLimite,temporada,
    fechaEnvio:fechaEnv||null,observaciones:obs,
    tipoPersonal:tipoPersonal||'',
    rutasTipo:rutasData.tipo,rutas:rutasData.rutas,
    areas:areasData,
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
    document.getElementById('bloquePersonal').style.display='none';
    document.getElementById('bloqueRutas').style.display='block';
    document.getElementById('bloqueAreas').style.display='none';
    document.getElementById('areasItemsCont').innerHTML='';
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
    const tpLabel = r.tipoPersonal==='OBREROS'?'<span class="badge badge-obrero tp-badge">👷 Obreros</span>':
                     r.tipoPersonal==='EMPLEADOS'?'<span class="badge badge-empleado tp-badge">💼 Empleados</span>':
                     '<span style="color:var(--gris-muted);font-size:10px;">–</span>';
    return `<tr>
      <td>${i+1}</td><td><strong>${esc(r.supervisor)}</strong></td><td>${esc(r.sector)}</td>
      <td>${tpLabel}</td>
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

let _chartEstado=null,_chartSupervisor=null,_chartMes=null,_chartTemporada=null;
function renderCharts(cumplido,proceso,leve,critico){
  // Estado
  const estadoData=[cumplido,proceso,leve,critico];
  if(_chartEstado){_chartEstado.data.datasets[0].data=estadoData;_chartEstado.update('none');}
  else{_chartEstado=new Chart(document.getElementById('chartEstado'),{type:'doughnut',data:{labels:['Cumplido','En Proceso','Retraso Leve','Retraso Crítico'],datasets:[{data:estadoData,backgroundColor:['#1a8040','#1a6fd4','#e07a2a','#cc0000'],borderWidth:0}]},options:{responsive:true,animation:{duration:300},plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:11}}}},cutout:'65%'}});}
  // Supervisor
  const sm={};
  registros.forEach(r=>{if(!sm[r.supervisor])sm[r.supervisor]={c:0,t:0};sm[r.supervisor].t++;if(calcularEstado(r).estado==='cumplido')sm[r.supervisor].c++;});
  const sl=Object.keys(sm),sp=sl.map(s=>Math.round((sm[s].c/sm[s].t)*100));
  if(_chartSupervisor){_chartSupervisor.data.labels=sl.map(s=>s.split(' ')[0]);_chartSupervisor.data.datasets[0].data=sp;_chartSupervisor.update('none');}
  else{_chartSupervisor=new Chart(document.getElementById('chartSupervisor'),{type:'bar',data:{labels:sl.map(s=>s.split(' ')[0]),datasets:[{label:'% Cumplimiento',data:sp,backgroundColor:'#003087',borderRadius:5}]},options:{responsive:true,animation:{duration:300},indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:v=>v+'%'}}}}});}
  // Mes
  const mm={},mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  registros.forEach(r=>{const m2=new Date(r.fechaEjecucion+'T12:00:00').getMonth();mm[m2]=(mm[m2]||0)+1;});
  const mk=Object.keys(mm).sort((a,b)=>a-b);
  if(_chartMes){_chartMes.data.labels=mk.map(k=>mn[k]);_chartMes.data.datasets[0].data=mk.map(k=>mm[k]);_chartMes.update('none');}
  else{_chartMes=new Chart(document.getElementById('chartMes'),{type:'line',data:{labels:mk.map(k=>mn[k]),datasets:[{label:'Registros',data:mk.map(k=>mm[k]),borderColor:'#0050c8',backgroundColor:'rgba(0,80,200,.10)',tension:.4,fill:true,pointRadius:5}]},options:{responsive:true,animation:{duration:300},plugins:{legend:{display:false}}}});}
  // Temporada
  const alta=registros.filter(r=>r.temporada==='alta').length;
  const tempData=[alta,registros.length-alta];
  if(_chartTemporada){_chartTemporada.data.datasets[0].data=tempData;_chartTemporada.update('none');}
  else{_chartTemporada=new Chart(document.getElementById('chartTemporada'),{type:'pie',data:{labels:['Temporada Alta','Temporada Baja'],datasets:[{data:tempData,backgroundColor:['#e8b94a','#0050c8'],borderWidth:0}]},options:{responsive:true,animation:{duration:300},plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:11}}}}}});}
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

function renderAll(){
  // Solo renderizar la pestaña activa para evitar parpadeo
  const activeTab = document.querySelector('.tab-content.active');
  if(!activeTab) return;
  const tabId = activeTab.id;
  // Siempre actualizar tabla (datos en memoria)
  renderTabla();
  if(tabId==='tab-dashboard') renderDashboard();
  else if(tabId==='tab-ranking') renderRanking();
  // Estadísticas NO se llaman desde aquí, solo al hacer clic en la pestaña
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

// ═══════════════════════════════════════════════════════════════
//  MÓDULO ESTADÍSTICO INDIVIDUAL
// ═══════════════════════════════════════════════════════════════

let chartGeneroStats=null, chartAvanceRetraso=null, chartMesStats=null;
let statsInitialized=false;

function initEstadisticas() {
  const selSup = document.getElementById('statSupervisor');
  const selTipo = document.getElementById('statTipo');
  const selPersonal = document.getElementById('statPersonal');
  if(!selSup||!selTipo) return;
  selSup.addEventListener('change', () => { actualizarSectorDisplay(); renderEstadisticas(); });
  selTipo.addEventListener('change', renderEstadisticas);
  if(selPersonal) selPersonal.addEventListener('change', renderEstadisticas);
  statsInitialized=true;
}

// Solo renderiza si la pestaña estadísticas está activa
function renderEstadisticasSiActivo() {
  const tab = document.getElementById('tab-estadisticas');
  if(tab && tab.classList.contains('active') && statsInitialized) {
    renderEstadisticas();
  }
}

function actualizarSectorDisplay() {
  const val = document.getElementById('statSupervisor').value;
  const display = document.getElementById('statSectorDisplay');
  if(!val) {
    display.textContent = '— Se completa al elegir supervisor —';
    display.style.color = 'var(--gris-muted)';
    return;
  }
  const sector = val.split('|')[1] || '';
  display.textContent = sector;
  display.style.color = 'var(--azul-deep)';
}

function filtrarRegistrosStats() {
  const supVal = document.getElementById('statSupervisor').value;
  const tipoVal = document.getElementById('statTipo').value;
  const personalEl = document.getElementById('statPersonal');
  const personalVal = personalEl ? personalEl.value : '';
  let data = [...registros];
  if(supVal) {
    const [sup, sector] = supVal.split('|');
    data = data.filter(r => r.supervisor === sup && r.sector === sector);
  }
  if(tipoVal) {
    data = data.filter(r => r.tema === tipoVal);
  }
  if(personalVal) {
    // Registros antiguos sin tipoPersonal se incluyen solo si no se filtra
    data = data.filter(r => r.tipoPersonal === personalVal);
  }
  return data;
}

function renderEstadisticas() {
  const data = filtrarRegistrosStats();
  const tipoVal = document.getElementById('statTipo').value;

  // ── KPIs ──
  const totalAct = data.length;
  const totalTrab = data.reduce((s,r) => s+r.total, 0);
  let enPlazo=0, enRetraso=0, sumDiasRet=0;
  data.forEach(r => {
    const est = calcularEstado(r);
    if(est.estado==='cumplido'||est.estado==='proceso') enPlazo++;
    else { enRetraso++; sumDiasRet+=est.diasRetraso; }
  });
  const pctAvance = totalAct>0 ? Math.round((enPlazo/totalAct)*100) : 0;
  const pctRetraso = totalAct>0 ? Math.round((enRetraso/totalAct)*100) : 0;
  const promDias = enRetraso>0 ? (sumDiasRet/enRetraso).toFixed(1) : 0;

  document.getElementById('skpiActividades').textContent = totalAct;
  document.getElementById('skpiTrabajadores').textContent = totalTrab;
  document.getElementById('skpiPlazo').textContent = enPlazo;
  document.getElementById('skpiRetraso').textContent = enRetraso;
  document.getElementById('skpiPctAvance').textContent = pctAvance+'%';
  document.getElementById('skpiPctRetraso').textContent = pctRetraso+'%';
  document.getElementById('skpiPromDias').textContent = promDias;

  // ── GÉNERO ──
  const totalV = data.reduce((s,r)=>s+r.varones,0);
  const totalM = data.reduce((s,r)=>s+r.mujeres,0);
  const totalG = totalV+totalM;
  const pctV = totalG>0 ? Math.round((totalV/totalG)*100) : 0;
  const pctM = totalG>0 ? Math.round((totalM/totalG)*100) : 0;

  // Labels según tipo
  const labMap = {
    'CAPACITACIONES ETI': ['Varones Capacitados','Mujeres Capacitadas'],
    'EVALUACIONES DE CHECKLIST': ['Varones Evaluados','Mujeres Evaluadas'],
    'REFORZAMIENTO': ['Varones Reforzados','Mujeres Reforzadas'],
    '': ['Varones','Mujeres']
  };
  const [lV,lM] = labMap[tipoVal]||labMap[''];
  document.getElementById('sgVaronesLabel').textContent = lV;
  document.getElementById('sgMujeresLabel').textContent = lM;
  document.getElementById('sgVaronesCount').textContent = totalV;
  document.getElementById('sgMujeresCount').textContent = totalM;
  document.getElementById('sgVaronesPct').textContent = pctV+'%';
  document.getElementById('sgMujeresPct').textContent = pctM+'%';
  document.getElementById('sgBarVarones').style.width = pctV+'%';
  document.getElementById('sgBarMujeres').style.width = pctM+'%';

  // Título género
  const tituloG = tipoVal ? `👥 Género – ${tipoVal}` : '👥 Distribución General por Género';
  document.getElementById('statsGeneroTitle').textContent = tituloG;

  // Chart género - update sin destruir para evitar parpadeo
  if(chartGeneroStats) {
    chartGeneroStats.data.labels=[lV,lM];
    chartGeneroStats.data.datasets[0].data=[totalV,totalM];
    chartGeneroStats.update('none');
  } else {
    chartGeneroStats = new Chart(document.getElementById('chartGeneroStats'),{
      type:'doughnut',
      data:{
        labels:[lV,lM],
        datasets:[{data:[totalV,totalM],backgroundColor:['#0050c8','#cc0000'],borderWidth:2,borderColor:'#fff'}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        animation:{duration:400},
        plugins:{
          legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10},boxWidth:12}},
          tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} (${totalG>0?Math.round(ctx.raw/totalG*100):0}%)`}}
        },
        cutout:'60%'
      }
    });
  }

  // ── SECTOR ──
  renderSectorStats(data);

  // ── GRÁFICOS ──
  renderChartAvanceRetraso(data);
  renderChartMesStats(data);

  // ── RUTAS / ÁREAS según filtro de personal ──
  const personalEl = document.getElementById('statPersonal');
  const personalVal = personalEl ? personalEl.value : '';
  const rutasPanel = document.getElementById('statsRutasPanel');
  const areasPanel = document.getElementById('statsAreasPanel');

  if(personalVal === 'EMPLEADOS') {
    if(rutasPanel) rutasPanel.style.display='none';
    if(areasPanel) areasPanel.style.display='block';
    renderAreasStats(data);
  } else if(personalVal === 'OBREROS') {
    if(rutasPanel) rutasPanel.style.display='block';
    if(areasPanel) areasPanel.style.display='none';
    renderRutasStats(data);
  } else {
    // Mostrar ambos
    if(rutasPanel) rutasPanel.style.display='block';
    if(areasPanel) areasPanel.style.display='block';
    renderRutasStats(data);
    renderAreasStats(data);
  }
}

function renderSectorStats(data) {
  const body = document.getElementById('statsSectorBody');
  const supVal = document.getElementById('statSupervisor').value;
  if(!supVal) {
    body.innerHTML='<p class="stats-empty">Selecciona un supervisor para ver estadísticas del sector.</p>';
    return;
  }
  const sector = supVal.split('|')[1]||'';
  const caps = data.filter(r=>r.tema==='CAPACITACIONES ETI').length;
  const checks = data.filter(r=>r.tema==='EVALUACIONES DE CHECKLIST').length;
  const refs = data.filter(r=>r.tema==='REFORZAMIENTO').length;
  const totalTrab = data.reduce((s,r)=>s+r.total,0);
  let plazo=0,ret=0;
  data.forEach(r=>{const e=calcularEstado(r).estado;if(e==='cumplido'||e==='proceso')plazo++;else ret++;});
  const pctA=data.length>0?Math.round(plazo/data.length*100):0;
  const pctR=data.length>0?Math.round(ret/data.length*100):0;

  body.innerHTML=`
    <div class="ssector-row"><div><div class="ssector-label">🏭 Sector</div><div class="ssector-sub">Ubicación</div></div><div class="ssector-value">${esc(sector)}</div></div>
    <div class="ssector-row"><div><div class="ssector-label">📚 Capacitaciones ETI</div><div class="ssector-sub">Total registradas</div></div><div class="ssector-value" style="color:#0050c8">${caps}</div></div>
    <div class="ssector-row"><div><div class="ssector-label">✅ Evaluaciones Checklist</div><div class="ssector-sub">Total registradas</div></div><div class="ssector-value" style="color:#1a8040">${checks}</div></div>
    <div class="ssector-row"><div><div class="ssector-label">🔄 Reforzamientos</div><div class="ssector-sub">Total registrados</div></div><div class="ssector-value" style="color:#e07a2a">${refs}</div></div>
    <div class="ssector-row"><div><div class="ssector-label">👥 Total Trabajadores</div><div class="ssector-sub">Intervenidos en el sector</div></div><div class="ssector-value">${totalTrab}</div></div>
    <div class="ssector-row"><div><div class="ssector-label">📈 % Avance</div><div class="ssector-sub">Actividades en plazo</div></div><div class="ssector-value" style="color:#1a8040">${pctA}%</div></div>
    <div class="ssector-row"><div><div class="ssector-label">📉 % Retraso</div><div class="ssector-sub">Actividades con retraso</div></div><div class="ssector-value" style="color:#cc0000">${pctR}%</div></div>`;
}

function renderChartAvanceRetraso(data) {
  const tipos = ['CAPACITACIONES ETI','EVALUACIONES DE CHECKLIST','REFORZAMIENTO'];
  const labels = ['Cap. ETI','Checklist','Reforzamiento'];
  const plazoData=[], retrasoData=[];
  tipos.forEach(t=>{
    const sub = data.filter(r=>r.tema===t);
    let p=0,r=0;
    sub.forEach(x=>{const e=calcularEstado(x).estado;if(e==='cumplido'||e==='proceso')p++;else r++;});
    plazoData.push(p);
    retrasoData.push(r);
  });
  if(chartAvanceRetraso) {
    chartAvanceRetraso.data.datasets[0].data=plazoData;
    chartAvanceRetraso.data.datasets[1].data=retrasoData;
    chartAvanceRetraso.update('none');
  } else {
    chartAvanceRetraso = new Chart(document.getElementById('chartAvanceRetraso'),{
      type:'bar',
      data:{
        labels,
        datasets:[
          {label:'En Plazo',data:plazoData,backgroundColor:'#1a8040',borderRadius:5},
          {label:'En Retraso',data:retrasoData,backgroundColor:'#cc0000',borderRadius:5}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        animation:{duration:300},
        plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:11}}}},
        scales:{x:{stacked:false},y:{beginAtZero:true,ticks:{stepSize:1}}}
      }
    });
  }
}

function renderChartMesStats(data) {
  const mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mm={};
  data.forEach(r=>{const m=new Date(r.fechaEjecucion+'T12:00:00').getMonth();mm[m]=(mm[m]||0)+1;});
  const keys=Object.keys(mm).sort((a,b)=>a-b);
  const newLabels=keys.map(k=>mn[k]);
  const newData=keys.map(k=>mm[k]);
  if(chartMesStats) {
    chartMesStats.data.labels=newLabels;
    chartMesStats.data.datasets[0].data=newData;
    chartMesStats.update('none');
  } else {
    chartMesStats = new Chart(document.getElementById('chartMesStats'),{
      type:'bar',
      data:{
        labels:newLabels,
        datasets:[{
          label:'Actividades',data:newData,
          backgroundColor:'#0050c8',borderRadius:6,
          borderSkipped:false
        }]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        animation:{duration:300},
        plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}
      }
    });
  }
}

function renderRutasStats(data) {
  const body = document.getElementById('statsRutasBody');
  // Recopilar todas las rutas de los registros filtrados
  const rutaMap = {};
  let totalRutas=0, rutasVarias=0;
  data.forEach(r=>{
    if(r.rutasTipo==='varias') { rutasVarias++; }
    else if(r.rutasTipo==='detalle'&&r.rutas&&r.rutas.length>0){
      r.rutas.forEach(rt=>{
        const key = rt.codigo||rt.nombre||'Sin código';
        if(!rutaMap[key]) rutaMap[key]={codigo:rt.codigo||'',nombre:rt.nombre||key,count:0};
        rutaMap[key].count++;
        totalRutas++;
      });
    }
  });
  const rutasList = Object.values(rutaMap).sort((a,b)=>b.count-a.count);
  if(rutasList.length===0&&rutasVarias===0){
    body.innerHTML='<p class="stats-empty">No hay datos de rutas para esta selección.</p>';
    return;
  }
  let html=`<div class="stats-rutas-summary">
    <div class="sruta-summary-item">🗺 Rutas con detalle: <strong>${rutasList.length}</strong></div>
    <div class="sruta-summary-item">📦 Actividades "Rutas Varias": <strong>${rutasVarias}</strong></div>
    <div class="sruta-summary-item">📋 Total intervenciones: <strong>${totalRutas}</strong></div>
  </div>`;
  if(rutasList.length>0){
    html+=`<div class="stats-rutas-grid">`;
    rutasList.forEach(rt=>{
      html+=`<div class="sruta-card">
        <div>
          <div class="sruta-name">${esc(rt.nombre)}</div>
          ${rt.codigo?`<div class="sruta-code">${esc(rt.codigo)}</div>`:''}
        </div>
        <div class="sruta-count">${rt.count}</div>
      </div>`;
    });
    html+=`</div>`;
  }
  body.innerHTML=html;
}

function renderAreasStats(data) {
  const body = document.getElementById('statsAreasBody');
  if(!body) return;

  // Solo registros con tipo EMPLEADOS y con áreas registradas
  const conAreas = data.filter(r => r.tipoPersonal==='EMPLEADOS' && r.areas && r.areas.length>0);

  if(conAreas.length===0) {
    body.innerHTML='<p class="stats-empty">No hay datos de áreas para esta selección. Los registros de empleados aparecerán aquí.</p>';
    return;
  }

  // Consolidar áreas
  const areaMap = {};
  let totalEmpleados=0, totalAreas=0;
  conAreas.forEach(r => {
    r.areas.forEach(a => {
      const key = a.nombre.toUpperCase();
      if(!areaMap[key]) areaMap[key]={nombre:a.nombre,empleados:0,actividades:0};
      areaMap[key].empleados += a.cantidad||0;
      areaMap[key].actividades++;
      totalEmpleados += a.cantidad||0;
      totalAreas++;
    });
  });

  const areasList = Object.values(areaMap).sort((a,b)=>b.empleados-a.empleados);

  let html=`<div class="stats-rutas-summary">
    <div class="sruta-summary-item">🏢 Áreas distintas: <strong>${areasList.length}</strong></div>
    <div class="sruta-summary-item">👥 Total empleados intervenidos: <strong>${totalEmpleados}</strong></div>
    <div class="sruta-summary-item">📋 Total intervenciones: <strong>${conAreas.length}</strong></div>
  </div>
  <div class="stats-rutas-grid">`;

  areasList.forEach(a => {
    html+=`<div class="sruta-card" style="border-left-color:#0050c8;">
      <div>
        <div class="sruta-name">🏢 ${esc(a.nombre)}</div>
        <div class="sruta-code">${a.actividades} actividad${a.actividades>1?'es':''}</div>
      </div>
      <div class="sruta-count" style="background:#e8f0ff;color:#0050c8;">${a.empleados}</div>
    </div>`;
  });
  html+=`</div>`;
  body.innerHTML=html;
}

// Hook al cambio de tab para inicializar estadísticas
const _origInitTabs = initTabs;

// ═══════════════════════════════════════════════════════════════
//  MÓDULO UNIDADES Y LICENCIAS
// ═══════════════════════════════════════════════════════════════

const COL_UNID = 'unidades_rrhh';
const COL_MANT = 'mantenimientos_rrhh';
const COL_LIC  = 'licencias_rrhh';

let uUnidades=[], uMantenimientos=[], uLicencias=[];
let uChartU=null, uChartL=null, uChartM=null, uChartLM=null;

const UNIDADES_BASE=[
  {dni:'46793507',usuario:'PULACHE VIERA FLOR DE LOS MILAGROS',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'TRX-420',marca:'HONDA',cod_interno:'CM-48',cod_sist:'VMT1056',numero_motor:'TE40E8702565',numero_chasis:'1HFTE40U4L4650073',anio:2020,estatus:'Operativo',zona_recorrido:'LOS OLIVARES',empresa:'RAPEL',zona_abastecimiento_actual:'LOS OLIVARES'},
  {dni:'73332618',usuario:'TINEO RAMOS ALEXANDER',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-122',cod_sist:'VMT1098',numero_motor:'KF07E-3021257',numero_chasis:'LTMKD0798P5306754',anio:2023,estatus:'Operativo',zona_recorrido:'FUNDOS VARIOS',empresa:'RAPEL',zona_abastecimiento_actual:'EL PAPAYO'},
  {dni:'76329783',usuario:'LUZON VENEGAS YHANELLY GERALDENY',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'TRX-250',marca:'HONDA',cod_interno:'CM-61',cod_sist:'VMT1075',numero_motor:'TE48-8401766',numero_chasis:'1HFTE21U3M4550048',anio:2021,estatus:'Operativo',zona_recorrido:'LOS ALGARROBOS',empresa:'RAPEL',zona_abastecimiento_actual:'LOS ALGARROBOS'},
  {dni:'44369480',usuario:'PACHERRE ORTIZ ALBERTH',cargo:'ASISTENTE DE BIENESTAR SOCIAL',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-71',cod_sist:'VMT1054',numero_motor:'KD07E3006782',numero_chasis:'LTMKD0796L5302082',anio:2020,estatus:'Operativo',zona_recorrido:'FUNDOS VARIOS',empresa:'RAPEL',zona_abastecimiento_actual:'EL PAPAYO'},
  {dni:'46073509',usuario:'TIMOTEO GONZA JOEL ANGEL',cargo:'COORDINADOR(a) DE RELACIONES LABORALES',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-122',cod_sist:'VMT1053',numero_motor:'KD07E3006686',numero_chasis:'LTMKD0799XL5302070',anio:2020,estatus:'Operativo',zona_recorrido:'FUNDOS VARIOS',empresa:'RAPEL',zona_abastecimiento_actual:'SANTA ROSA'},
  {dni:'72952979',usuario:'MARTINEZ JUAREZ ALEXANDER',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-74',cod_sist:'VMT0059',numero_motor:'KD07E-3010238',numero_chasis:'LTMKD0797M5302593',anio:2021,estatus:'Operativo',zona_recorrido:'APROA',empresa:'RAPEL',zona_abastecimiento_actual:'APROA'},
  {dni:'47070759',usuario:'CHAVEZ CORDOVA JORGE',cargo:'COORDINADOR(a) DE RELACIONES LABORALES',modelo:'TRX-420',marca:'HONDA',cod_interno:'CM-49',cod_sist:'VMT1060',numero_motor:'TE40E8702563',numero_chasis:'1HFTE40U4L4650079',anio:2020,estatus:'Operativo',zona_recorrido:'OLIVARES BAJO',empresa:'RAPEL',zona_abastecimiento_actual:'OLIVARES BAJO'},
  {dni:'77299457',usuario:'YPANAQUE YMAN MARCO POLO',cargo:'ASISTENTE DE RELACIONES LABORALES',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-72',cod_sist:'VMT1053',numero_motor:'KD07E3006686',numero_chasis:'LTMKD079XL5302070',anio:2020,estatus:'Operativo',zona_recorrido:'OLIVARES BAJO',empresa:'RAPEL',zona_abastecimiento_actual:'SANTA ROSA'},
  {dni:'72954772',usuario:'TAMAYO RODRIGUEZ POOL WILFREDO',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-44',cod_sist:'VMT0035',numero_motor:'KD07E-2120190',numero_chasis:'LTMKD0797G5212199',anio:2015,estatus:'Operativo',zona_recorrido:'EL PAPAYO',empresa:'RAPEL',zona_abastecimiento_actual:'EL PAPAYO'},
  {dni:'73091524',usuario:'CASTRO BAYONA ELBERTH JAN PIERRE',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-92',cod_sist:'VMT1061',numero_motor:'KD07E-3006683',numero_chasis:'LTMKD0794L5302002',anio:2020,estatus:'Operativo',zona_recorrido:'SANTA ROSA I Y II',empresa:'VERFRUT',zona_abastecimiento_actual:'SANTA ROSA'},
  {dni:'75656528',usuario:'ZAPATA SUAREZ ALEX FABIAN',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-89',cod_sist:'VMT0056',numero_motor:'KD07E-3010262',numero_chasis:'LTMKD0793M5302722',anio:2021,estatus:'Operativo',zona_recorrido:'PUNTA ARENAS',empresa:'RAPEL',zona_abastecimiento_actual:'PUNTA ARENAS'},
  {dni:'46066300',usuario:'VIERA GIRON SERGIO',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-73',cod_sist:'VMT1048',numero_motor:'KD07E3006645',numero_chasis:'LTMKD0795L5302106',anio:2020,estatus:'Operativo',zona_recorrido:'SAN VICENTE',empresa:'RAPEL',zona_abastecimiento_actual:'SAN VICENTE'},
  {dni:'76308925',usuario:'MORALES YARLEQUE BILL',cargo:'ANALISTA DE BIENESTAR SOCIAL',modelo:'XR-150L',marca:'HONDA',cod_interno:'ML-71',cod_sist:'VMT1054',numero_motor:'KD07E3006782',numero_chasis:'LTMKD0796L5302082',anio:2020,estatus:'Operativo',zona_recorrido:'FUNDOS VARIOS',empresa:'RAPEL',zona_abastecimiento_actual:'EL PAPAYO'},
  {dni:'45984661',usuario:'HERNANDEZ BORRERO JOHN',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'TRX-250',marca:'HONDA',cod_interno:'CM-61',cod_sist:'VMT1075',numero_motor:'TE48-8401766',numero_chasis:'1HFTE21U3M4550048',anio:2021,estatus:'Operativo',zona_recorrido:'LOS ALGARROBOS',empresa:'RAPEL',zona_abastecimiento_actual:'LOS ALGARROBOS'},
  {dni:'74218729',usuario:'MOLERO ABAD ROBERTO CARLOS',cargo:'SUPERVISOR(A) DE GESTION HUMANA',modelo:'TRX-250',marca:'HONDA',cod_interno:'CM-61',cod_sist:'VMT1075',numero_motor:'TE48-8401766',numero_chasis:'1HFTE21U3M4550048',anio:2021,estatus:'Operativo',zona_recorrido:'LOS ALGARROBOS',empresa:'RAPEL',zona_abastecimiento_actual:'LOS ALGARROBOS'}
];

// ── INIT ──────────────────────────────────────────────────────
async function initUnidades() {
  if(document.getElementById('u-dashboard')===null) return;
  initSubTabs();
  await uCargarUnidades();
  await uCargarMantenimientos();
  await uCargarLicencias();
  uPoblarSelectores();
  uInitFormMant();
  uInitFormLic();
  uInitFiltros();
  uInitBotones();
  uRenderDashboard();
  uRenderTablaUnid();
  uRenderTablaMant();
  uRenderTablaLic();
}

function initSubTabs(){
  document.querySelectorAll('.unid-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.unid-tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.unid-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.utab).classList.add('active');
    });
  });
}

// ── CARGAR DATOS ──────────────────────────────────────────────
async function uCargarUnidades(){
  try{
    const snap=await getDocs(collection(db,COL_UNID));
    if(snap.empty){
      for(const u of UNIDADES_BASE) await addDoc(collection(db,COL_UNID),u);
      const s2=await getDocs(collection(db,COL_UNID));
      uUnidades=s2.docs.map(d=>({id:d.id,...d.data()}));
    } else {
      uUnidades=snap.docs.map(d=>({id:d.id,...d.data()}));
    }
  }catch(e){uUnidades=[...UNIDADES_BASE.map((u,i)=>({id:'local'+i,...u}))];}
}

async function uCargarMantenimientos(){
  try{
    const snap=await getDocs(query(collection(db,COL_MANT),orderBy('fecha_registro','desc')));
    uMantenimientos=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){uMantenimientos=[];}
}

async function uCargarLicencias(){
  try{
    const snap=await getDocs(query(collection(db,COL_LIC),orderBy('fecha_registro','desc')));
    uLicencias=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){uLicencias=[];}
}

// ── SELECTORES ────────────────────────────────────────────────
function uPoblarSelectores(){
  const opts=uUnidades.map(u=>`<option value="${u.dni}">${esc(u.usuario)} – ${esc(u.cod_interno)}</option>`).join('');
  ['uMSup','uLSup'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.innerHTML='<option value="">— Seleccionar —</option>'+opts;
  });
}

// ── FORM MANTENIMIENTO ─────────────────────────────────────────
function uInitFormMant(){
  document.getElementById('uMSup')?.addEventListener('change',function(){
    const u=uUnidades.find(x=>x.dni===this.value);
    document.getElementById('uMCod').value=u?u.cod_interno:'';
    document.getElementById('uMModelo').value=u?u.modelo:'';
    document.getElementById('uMMarca').value=u?u.marca:'';
  });
  ['uMKmAnt','uMKmAct','uMTipo'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',uCalcKm);
    document.getElementById(id)?.addEventListener('change',uCalcKm);
  });
  document.getElementById('uBtnSaveMant')?.addEventListener('click',uGuardarMant);
  document.getElementById('uBtnClearMant')?.addEventListener('click',uLimpiarMant);
}

function uCalcKm(){
  const ant=parseInt(document.getElementById('uMKmAnt').value)||0;
  const act=parseInt(document.getElementById('uMKmAct').value)||0;
  const tipo=document.getElementById('uMTipo').value;
  const rec=act-ant;
  const prox=tipo==='Preventivo'?act+2500:tipo==='General'?act+5000:0;
  document.getElementById('uMKmRec').value=rec>0?rec:'';
  document.getElementById('uMProxKm').value=prox>0?prox:'';
}

async function uGuardarMant(){
  const dni=document.getElementById('uMSup').value;
  const u=uUnidades.find(x=>x.dni===dni);
  if(!u){showToast('Selecciona un supervisor',true);return;}
  const fecha=document.getElementById('uMFecha').value;
  const tipo=document.getElementById('uMTipo').value;
  const kmAct=parseInt(document.getElementById('uMKmAct').value);
  if(!fecha||!tipo||!kmAct){showToast('Completa los campos obligatorios (*)',true);return;}
  const kmAnt=parseInt(document.getElementById('uMKmAnt').value)||0;
  const reg={
    dni,usuario:u.usuario,cod_interno:u.cod_interno,
    fecha_mantenimiento:fecha,tipo_mantenimiento:tipo,
    km_anterior:kmAnt,km_actual:kmAct,km_recorrido:kmAct-kmAnt,
    proximo_km:tipo==='Preventivo'?kmAct+2500:kmAct+5000,
    observaciones:document.getElementById('uMObs').value.trim(),
    fecha_registro:new Date().toISOString()
  };
  try{
    const ref=await addDoc(collection(db,COL_MANT),reg);
    uMantenimientos.unshift({id:ref.id,...reg});
    uRenderTablaMant(); uRenderDashboard(); uLimpiarMant();
    showToast('✅ Mantenimiento registrado',false,true);
  }catch(e){showToast('Error al guardar',true);}
}

function uLimpiarMant(){
  ['uMSup','uMTipo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['uMCod','uMModelo','uMMarca','uMFecha','uMKmAnt','uMKmAct','uMKmRec','uMProxKm','uMObs'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

// ── FORM LICENCIAS ─────────────────────────────────────────────
function uInitFormLic(){
  document.getElementById('uLSup')?.addEventListener('change',function(){
    const u=uUnidades.find(x=>x.dni===this.value);
    document.getElementById('uLDni').value=u?u.dni:'';
    document.getElementById('uLCod').value=u?u.cod_interno:'';
    document.getElementById('uLCargo').value=u?u.cargo:'';
  });
  document.getElementById('uLFReval')?.addEventListener('change',uCalcLic);
  document.getElementById('uBtnSaveLic')?.addEventListener('click',uGuardarLic);
  document.getElementById('uBtnClearLic')?.addEventListener('click',uLimpiarLic);
}

function uCalcLic(){
  const reval=document.getElementById('uLFReval').value;
  if(!reval){document.getElementById('uLDias').value='';document.getElementById('uLEstado').value='';return;}
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const dias=Math.round((new Date(reval+'T12:00:00')-hoy)/(1000*60*60*24));
  document.getElementById('uLDias').value=dias;
  let estado='';
  if(dias>30)estado='Vigente ✅';
  else if(dias>15)estado='Por Vencer ⚠️';
  else if(dias>7)estado='Riesgo 🟠';
  else if(dias>0)estado='Crítico 🔴';
  else estado='Vencida 🚨';
  document.getElementById('uLEstado').value=estado;
}

async function uGuardarLic(){
  const dni=document.getElementById('uLSup').value;
  const u=uUnidades.find(x=>x.dni===dni);
  if(!u){showToast('Selecciona un supervisor',true);return;}
  const numero=document.getElementById('uLNum').value.trim();
  const tipo=document.getElementById('uLTipo').value;
  const reval=document.getElementById('uLFReval').value;
  if(!numero||!tipo||!reval){showToast('Completa los campos obligatorios (*)',true);return;}
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const dias=Math.round((new Date(reval+'T12:00:00')-hoy)/(1000*60*60*24));
  let estado='vigente';
  if(dias<=0)estado='vencido';
  else if(dias<=7)estado='critico';
  else if(dias<=15)estado='riesgo';
  else if(dias<=30)estado='por_vencer';
  const reg={
    dni,usuario:u.usuario,cod_interno:u.cod_interno,cargo:u.cargo,
    numero_licencia:numero,tipo_licencia:tipo,
    fecha_expedicion:document.getElementById('uLFExp').value||'',
    fecha_revalidacion:reval,dias_restantes:dias,estado,
    fecha_registro:new Date().toISOString()
  };
  try{
    const ref=await addDoc(collection(db,COL_LIC),reg);
    uLicencias.unshift({id:ref.id,...reg});
    uRenderTablaLic(); uRenderDashboard(); uLimpiarLic();
    showToast('✅ Licencia registrada',false,true);
  }catch(e){showToast('Error al guardar',true);}
}

function uLimpiarLic(){
  ['uLSup','uLTipo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['uLDni','uLCod','uLCargo','uLNum','uLFExp','uLFReval','uLDias','uLEstado'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

// ── FILTROS ───────────────────────────────────────────────────
function uInitFiltros(){
  ['uFiltDni','uFiltUser','uFiltEmp','uFiltEst'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',uRenderTablaUnid);
    document.getElementById(id)?.addEventListener('change',uRenderTablaUnid);
  });
  ['uFiltMUser','uFiltMTipo'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',uRenderTablaMant);
    document.getElementById(id)?.addEventListener('change',uRenderTablaMant);
  });
  ['uFiltLUser','uFiltLEst'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',uRenderTablaLic);
    document.getElementById(id)?.addEventListener('change',uRenderTablaLic);
  });
}

// ── BOTONES EXCEL ─────────────────────────────────────────────
function uInitBotones(){
  document.getElementById('uBtnExpUnid')?.addEventListener('click',()=>uExportExcel(uUnidades,'Unidades','unidades_verfrut.xlsx'));
  document.getElementById('uBtnExpMant')?.addEventListener('click',()=>uExportExcel(uMantenimientos,'Mantenimientos','mantenimientos_verfrut.xlsx'));
  document.getElementById('uBtnExpLic')?.addEventListener('click',()=>uExportExcel(uLicencias,'Licencias','licencias_verfrut.xlsx'));
}

function uExportExcel(data,sheet,filename){
  if(!data.length){showToast('Sin datos para exportar',true);return;}
  const ws=XLSX.utils.json_to_sheet(data.map(r=>{const{id,...rest}=r;return rest;}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheet);
  XLSX.writeFile(wb,filename);
  showToast('📥 Excel exportado');
}

// ── RENDER UNIDADES ───────────────────────────────────────────
function uRenderTablaUnid(){
  const fD=(document.getElementById('uFiltDni')?.value||'').toLowerCase();
  const fU=(document.getElementById('uFiltUser')?.value||'').toLowerCase();
  const fE=(document.getElementById('uFiltEmp')?.value||'').toLowerCase();
  const fS=(document.getElementById('uFiltEst')?.value||'').toLowerCase();
  let data=[...uUnidades];
  if(fD) data=data.filter(r=>r.dni.toLowerCase().includes(fD));
  if(fU) data=data.filter(r=>r.usuario.toLowerCase().includes(fU));
  if(fE) data=data.filter(r=>(r.empresa||'').toLowerCase()===fE);
  if(fS) data=data.filter(r=>(r.estatus||'').toLowerCase()===fS);
  const tbody=document.getElementById('uTbodyUnid');
  if(!tbody)return;
  if(!data.length){tbody.innerHTML='<tr><td colspan="14" class="unid-empty">Sin resultados.</td></tr>';return;}
  tbody.innerHTML=data.map(r=>`<tr>
    <td>${esc(r.dni)}</td>
    <td><strong>${esc(r.usuario)}</strong></td>
    <td style="font-size:10px;max-width:140px;">${esc(r.cargo)}</td>
    <td>${esc(r.modelo)}</td><td>${esc(r.marca)}</td>
    <td><span class="unid-badge unid-badge-azul">${esc(r.cod_interno)}</span></td>
    <td>${esc(r.cod_sist||'')}</td>
    <td style="font-size:10px;">${esc(r.numero_motor||'')}</td>
    <td style="font-size:10px;">${esc(r.numero_chasis||'')}</td>
    <td>${r.anio||''}</td>
    <td>
      <select class="unid-edit-input" onchange="uGuardarCampo('${r.id}','estatus',this.value)" style="width:120px;">
        <option ${r.estatus==='Operativo'?'selected':''}>Operativo</option>
        <option ${r.estatus==='Inoperativo'?'selected':''}>Inoperativo</option>
      </select>
    </td>
    <td>${esc(r.zona_recorrido||'')}</td>
    <td>${esc(r.empresa||'')}</td>
    <td>
      <input class="unid-edit-input" type="text" value="${esc(r.zona_abastecimiento_actual||'')}"
        onblur="uGuardarCampo('${r.id}','zona_abastecimiento_actual',this.value)"
        style="width:130px;" placeholder="Zona..."/>
    </td>
  </tr>`).join('');
}

window.uGuardarCampo=async function(id,campo,valor){
  try{
    await updateDoc(doc(db,COL_UNID,id),{[campo]:valor});
    const idx=uUnidades.findIndex(u=>u.id===id);
    if(idx!==-1)uUnidades[idx][campo]=valor;
    uRenderDashboard();
    showToast('✅ Campo actualizado');
  }catch(e){showToast('Error al actualizar',true);}
};

// ── RENDER MANTENIMIENTO ──────────────────────────────────────
function uRenderTablaMant(){
  const fU=(document.getElementById('uFiltMUser')?.value||'').toLowerCase();
  const fT=(document.getElementById('uFiltMTipo')?.value||'').toLowerCase();
  let data=[...uMantenimientos];
  if(fU) data=data.filter(r=>(r.usuario||'').toLowerCase().includes(fU)||(r.cod_interno||'').toLowerCase().includes(fU));
  if(fT) data=data.filter(r=>(r.tipo_mantenimiento||'').toLowerCase()===fT);
  const tbody=document.getElementById('uTbodyMant');
  if(!tbody)return;
  if(!data.length){tbody.innerHTML='<tr><td colspan="12" class="unid-empty">Sin registros de mantenimiento.</td></tr>';return;}
  tbody.innerHTML=data.map((r,i)=>{
    const tBadge=r.tipo_mantenimiento==='Preventivo'?'<span class="unid-badge unid-badge-azul">🔵 Prev.</span>':'<span class="unid-badge unid-badge-naranja">🟠 Gral.</span>';
    const diff=r.proximo_km&&r.km_actual?r.proximo_km-r.km_actual:null;
    let kmEst='<span class="unid-badge unid-badge-gris">–</span>';
    if(diff!==null){
      if(diff>300)kmEst=`<span class="unid-badge unid-badge-verde">🟢 ${Number(diff).toLocaleString()} km</span>`;
      else if(diff>0)kmEst=`<span class="unid-badge unid-badge-amarillo">🟡 ${Number(diff).toLocaleString()} km</span>`;
      else kmEst='<span class="unid-badge unid-badge-rojo">🔴 Límite superado</span>';
    }
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(r.usuario||'')}</strong></td>
      <td><span class="unid-badge unid-badge-azul">${esc(r.cod_interno||'')}</span></td>
      <td>${uFmtFecha(r.fecha_mantenimiento)}</td>
      <td>${tBadge}</td>
      <td>${Number(r.km_anterior||0).toLocaleString()}</td>
      <td>${Number(r.km_actual||0).toLocaleString()}</td>
      <td>${Number(r.km_recorrido||0).toLocaleString()}</td>
      <td>${Number(r.proximo_km||0).toLocaleString()}</td>
      <td>${kmEst}</td>
      <td style="max-width:160px;font-size:10px;">${esc(r.observaciones||'–')}</td>
      <td><button class="unid-btn unid-btn-danger" style="padding:4px 8px;font-size:10px;" onclick="uEliminarMant('${r.id}')">🗑</button></td>
    </tr>`;
  }).join('');
}

window.uEliminarMant=async function(id){
  if(!confirm('¿Eliminar este registro de mantenimiento?'))return;
  try{
    await deleteDoc(doc(db,COL_MANT,id));
    uMantenimientos=uMantenimientos.filter(m=>m.id!==id);
    uRenderTablaMant(); uRenderDashboard();
    showToast('🗑 Eliminado');
  }catch(e){showToast('Error al eliminar',true);}
};

// ── RENDER LICENCIAS ──────────────────────────────────────────
function uRenderTablaLic(){
  const fU=(document.getElementById('uFiltLUser')?.value||'').toLowerCase();
  const fE=(document.getElementById('uFiltLEst')?.value||'');
  const hoy=new Date();hoy.setHours(0,0,0,0);
  let data=[...uLicencias].map(l=>{
    const dias=l.fecha_revalidacion?Math.round((new Date(l.fecha_revalidacion+'T12:00:00')-hoy)/(1000*60*60*24)):null;
    return{...l,_dias:dias};
  });
  if(fU) data=data.filter(r=>(r.usuario||'').toLowerCase().includes(fU)||(r.dni||'').includes(fU));
  if(fE) data=data.filter(r=>r.estado===fE);
  const tbody=document.getElementById('uTbodyLic');
  if(!tbody)return;
  if(!data.length){tbody.innerHTML='<tr><td colspan="11" class="unid-empty">Sin registros de licencias.</td></tr>';return;}
  tbody.innerHTML=data.map((r,i)=>{
    const d=r._dias;
    const badge=d===null?'<span class="unid-badge unid-badge-gris">–</span>':
      d>30?'<span class="unid-badge unid-badge-verde">✅ Vigente</span>':
      d>15?'<span class="unid-badge unid-badge-amarillo">⚠️ Por Vencer</span>':
      d>7?'<span class="unid-badge unid-badge-naranja">🟠 Riesgo</span>':
      d>0?'<span class="unid-badge unid-badge-rojo">🔴 Crítico</span>':
      '<span class="unid-badge unid-badge-rojo" style="background:#7a0000;color:#fff;">🚨 Vencida</span>';
    const diasCell=d===null?'–':d<0?`<strong style="color:#cc0000">${d} días</strong>`:`<strong>${d} días</strong>`;
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(r.usuario||'')}</strong></td>
      <td>${esc(r.dni||'')}</td>
      <td><span class="unid-badge unid-badge-azul">${esc(r.cod_interno||'')}</span></td>
      <td>${esc(r.numero_licencia||'')}</td>
      <td><span class="unid-badge unid-badge-gris">${esc(r.tipo_licencia||'')}</span></td>
      <td>${uFmtFecha(r.fecha_expedicion)}</td>
      <td>${uFmtFecha(r.fecha_revalidacion)}</td>
      <td>${diasCell}</td>
      <td>${badge}</td>
      <td><button class="unid-btn unid-btn-danger" style="padding:4px 8px;font-size:10px;" onclick="uEliminarLic('${r.id}')">🗑</button></td>
    </tr>`;
  }).join('');
}

window.uEliminarLic=async function(id){
  if(!confirm('¿Eliminar este registro de licencia?'))return;
  try{
    await deleteDoc(doc(db,COL_LIC,id));
    uLicencias=uLicencias.filter(l=>l.id!==id);
    uRenderTablaLic(); uRenderDashboard();
    showToast('🗑 Eliminado');
  }catch(e){showToast('Error al eliminar',true);}
};

// ── DASHBOARD ─────────────────────────────────────────────────
function uRenderDashboard(){
  const total=uUnidades.length;
  const operativas=uUnidades.filter(u=>u.estatus==='Operativo').length;
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const licDias=uLicencias.map(l=>({
    ...l,
    _dias:l.fecha_revalidacion?Math.round((new Date(l.fecha_revalidacion+'T12:00:00')-hoy)/(1000*60*60*24)):null
  }));
  const vigentes=licDias.filter(l=>l._dias!==null&&l._dias>30).length;
  const porVencer=licDias.filter(l=>l._dias!==null&&l._dias>=0&&l._dias<=30).length;
  const vencidas=licDias.filter(l=>l._dias!==null&&l._dias<0).length;

  document.getElementById('ukTotal').textContent=total;
  document.getElementById('ukOperativas').textContent=operativas;
  document.getElementById('ukInoperativas').textContent=total-operativas;
  document.getElementById('ukVigentes').textContent=vigentes;
  document.getElementById('ukPorVencer').textContent=porVencer;
  document.getElementById('ukVencidas').textContent=vencidas;
  document.getElementById('ukMant').textContent=uMantenimientos.length;

  // Alertas
  const alertas=licDias.filter(l=>l._dias!==null&&l._dias<=30).sort((a,b)=>a._dias-b._dias);
  const aDiv=document.getElementById('uAlertas');
  if(aDiv){
    if(!alertas.length){aDiv.innerHTML='<p class="unid-empty">✅ Sin alertas. Todas las licencias vigentes.</p>';}
    else{
      aDiv.innerHTML=alertas.map(l=>{
        const cls=l._dias<0?'unid-alert-rojo':l._dias<=7?'unid-alert-rojo':l._dias<=15?'unid-alert-naranja':'unid-alert-amarillo';
        const icon=l._dias<0?'🚨':l._dias<=7?'🔴':l._dias<=15?'🟠':'⚠️';
        return `<div class="unid-alert ${cls}">
          <span class="unid-alert-icon">${icon}</span>
          <div><strong>${esc(l.usuario||'')}</strong> – ${esc(l.cod_interno||'')} – Lic: ${esc(l.numero_licencia||'')}
          <br>Vence: <strong>${uFmtFecha(l.fecha_revalidacion)}</strong> | 
          <strong>${l._dias<0?Math.abs(l._dias)+' días vencida':l._dias+' días restantes'}</strong></div>
        </div>`;
      }).join('');
    }
  }

  // Charts
  uRenderCharts(operativas,total-operativas,vigentes,porVencer,vencidas);
}

function uRenderCharts(op,inop,vig,pv,venc){
  const mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  if(uChartU){uChartU.data.datasets[0].data=[op,inop];uChartU.update('none');}
  else{uChartU=new Chart(document.getElementById('uChartUnid'),{type:'doughnut',data:{labels:['Operativas','Inoperativas'],datasets:[{data:[op,inop],backgroundColor:['#1a8040','#cc0000'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}},cutout:'60%'}});}

  if(uChartL){uChartL.data.datasets[0].data=[vig,pv,venc];uChartL.update('none');}
  else{uChartL=new Chart(document.getElementById('uChartLic'),{type:'doughnut',data:{labels:['Vigentes','Por Vencer/Riesgo','Vencidas'],datasets:[{data:[vig,pv,venc],backgroundColor:['#1a8040','#e07a2a','#cc0000'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}},cutout:'60%'}});}

  const mm={};
  uMantenimientos.forEach(m=>{const mo=new Date((m.fecha_mantenimiento||'2000-01-01')+'T12:00:00').getMonth();mm[mo]=(mm[mo]||0)+1;});
  const mks=Object.keys(mm).sort((a,b)=>a-b);
  if(uChartM){uChartM.data.labels=mks.map(k=>mn[k]);uChartM.data.datasets[0].data=mks.map(k=>mm[k]);uChartM.update('none');}
  else{uChartM=new Chart(document.getElementById('uChartMant'),{type:'bar',data:{labels:mks.map(k=>mn[k]),datasets:[{label:'Mant.',data:mks.map(k=>mm[k]),backgroundColor:'#0050c8',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}});}

  const lm={};
  uLicencias.forEach(l=>{if(l.fecha_revalidacion){const mo=new Date(l.fecha_revalidacion+'T12:00:00').getMonth();lm[mo]=(lm[mo]||0)+1;}});
  const lks=Object.keys(lm).sort((a,b)=>a-b);
  if(uChartLM){uChartLM.data.labels=lks.map(k=>mn[k]);uChartLM.data.datasets[0].data=lks.map(k=>lm[k]);uChartLM.update('none');}
  else{uChartLM=new Chart(document.getElementById('uChartLicMes'),{type:'bar',data:{labels:lks.map(k=>mn[k]),datasets:[{label:'Licencias',data:lks.map(k=>lm[k]),backgroundColor:'#cc0000',borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}});}
}

// ── UTILS UNIDADES ────────────────────────────────────────────
function uFmtFecha(str){if(!str)return'–';try{const[y,m,d]=str.split('-');const mn=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return`${d}/${mn[parseInt(m)-1]}/${y}`;}catch{return str;}}

