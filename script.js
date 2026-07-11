// ════════════════════════════════════════════════
//  SISTEMA ETI v5.0 — VERFRUT · RAPEL
//  Capacitaciones de Ética e Integridad
//  Firebase Firestore · Chart.js · SheetJS · jsPDF
// ════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc",
  authDomain: "sistema-eti-verfrut.firebaseapp.com",
  projectId: "sistema-eti-verfrut",
  storageBucket: "sistema-eti-verfrut.firebasestorage.app",
  messagingSenderId: "209614676744",
  appId: "1:209614676744:web:23b4b1cd8c18b77e9742bd"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
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
let chEstados=null, chTendencia=null;
let stEstados=null, stTemas=null, stSupervisores=null, stTrabajadores=null, stMensual=null, stTemporada=null, stPersonal=null;

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
  if(!found) { errDiv.style.display='block'; return; }
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
  initFiltros();
  initBotones();
  escucharFirebase();
}

function cerrarSesion() {
  if(unsubscribe) { unsubscribe(); unsubscribe=null; }
  usuarioActual=null;
  document.getElementById('appPage').style.display='none';
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
}

// ─── FIREBASE REALTIME ────────────────────────────────────────
function escucharFirebase() {
  const q = query(collection(db, COL), orderBy('creadoEn', 'desc'));
  unsubscribe = onSnapshot(q, snap => {
    registros = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      ...calcularFechaLimite(d.data().fechaEjecucion)
    }));
    renderTodo();
  }, err => {
    console.error('Firebase error:', err);
    showToast('⚠️ Error de conexión con la nube', true);
  });
}

function renderTodo() {
  renderDashboard();
  renderTabla();
  renderRanking();
  renderEstadisticas();
}

// ─── TEMPORADA / DÍAS HÁBILES ─────────────────────────────────
// Baja: 5-ene al 26-jun → Lun-Vie | Alta: 27-jun al 31-dic (y 1-4 ene) → Lun-Sáb
function detectarTemporada(fecha) {
  const d = typeof fecha==='string' ? new Date(fecha+'T12:00:00') : new Date(fecha);
  const val = (d.getMonth()+1)*100 + d.getDate();
  return (val>=105 && val<=626) ? 'baja' : 'alta';
}
function esFestivo(fecha) {
  const mm=String(fecha.getMonth()+1).padStart(2,'0');
  const dd=String(fecha.getDate()).padStart(2,'0');
  return FESTIVOS_PERU.includes(mm+'-'+dd);
}
function esDiaHabil(fecha, temporada) {
  const dow=fecha.getDay();
  if(dow===0) return false;
  if(temporada==='baja' && dow===6) return false;
  if(esFestivo(fecha)) return false;
  return true;
}
function calcularFechaLimite(fechaEjecStr) {
  const temporada=detectarTemporada(fechaEjecStr);
  let d=new Date(fechaEjecStr+'T12:00:00');
  let habiles=0;
  while(habiles<3) {
    d.setDate(d.getDate()+1);
    if(esDiaHabil(d, temporada)) habiles++;
  }
  return { fechaLimite:formatDate(d), temporada };
}
function contarDiasHabiles(desde, hasta) {
  let count=0;
  let d=new Date(desde.getTime());
  d.setDate(d.getDate()+1);
  while(d<=hasta) {
    const temp=detectarTemporada(d);
    if(esDiaHabil(d, temp)) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}

// ─── ESTADO ───────────────────────────────────────────────────
function calcularEstado(reg) {
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const fLimite=new Date(reg.fechaLimite+'T12:00:00');
  const fEjec=new Date(reg.fechaEjecucion+'T12:00:00');
  const fEnvio=reg.fechaEnvio ? new Date(reg.fechaEnvio+'T12:00:00') : null;

  if(fEnvio) {
    if(fEnvio<=fLimite) return { estado:'cumplido', avance:100, retraso:0, diasRetraso:0 };
    const dr=contarDiasHabiles(fLimite, fEnvio);
    return { estado: dr<=2?'leve':'critico', avance:0, retraso:Math.min(Math.round((dr/3)*100),100), diasRetraso:dr };
  }
  if(hoy<=fLimite) {
    const du=contarDiasHabiles(fEjec, hoy);
    return { estado:'proceso', avance:Math.min(Math.round((du/3)*100),99), retraso:0, diasRetraso:0 };
  }
  const dr=contarDiasHabiles(fLimite, hoy);
  return { estado: dr<=2?'leve':'critico', avance:0, retraso:Math.min(Math.round((dr/3)*100),100), diasRetraso:dr };
}

const ESTADO_META = {
  cumplido: { label:'✅ Cumplido',        badge:'badge-verde',   color:'#1a8040' },
  proceso:  { label:'⏳ En Proceso',      badge:'badge-azul',    color:'#0050c8' },
  leve:     { label:'⚠️ Retraso Leve',    badge:'badge-amarillo',color:'#c89010' },
  critico:  { label:'🚨 Retraso Crítico', badge:'badge-rojo',    color:'#cc0000' }
};

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

// ─── TABS ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    });
  });
}

// ─── FORM ─────────────────────────────────────────────────────
function initForm() {
  document.getElementById('fSupervisor').addEventListener('change', function() {
    document.getElementById('fSector').value=this.value ? this.value.split('|')[1]||'' : '';
    verificarRetrasoForm();
  });

  // Tema → mostrar tipo personal
  document.getElementById('fTema').addEventListener('change', function() {
    document.getElementById('bloqueTipoPersonal').style.display=this.value?'block':'none';
  });

  // Tipo personal → rutas u áreas
  document.querySelectorAll('input[name="tipoPersonal"]').forEach(r => {
    r.addEventListener('change', function() {
      document.querySelectorAll('.radio-chip').forEach(c=>c.classList.remove('selected'));
      this.closest('.radio-chip').classList.add('selected');
      const esObrero=this.value==='OBREROS';
      document.getElementById('rutasCont').style.display=esObrero?'block':'none';
      document.getElementById('areasCont').style.display=esObrero?'none':'block';
      if(!esObrero) {
        document.querySelectorAll('input[name="rutasModo"]').forEach(x=>x.checked=false);
        document.getElementById('rutasNumeroCont').style.display='none';
        document.getElementById('rutasVariasCont').style.display='none';
        document.getElementById('rutasItemsCont').innerHTML='';
      } else {
        document.getElementById('areasItemsCont').innerHTML='';
        document.getElementById('fNumAreas').value='';
      }
    });
  });

  // Modo rutas
  document.querySelectorAll('input[name="rutasModo"]').forEach(r => {
    r.addEventListener('change', function() {
      document.getElementById('rutasNumeroCont').style.display=this.value==='numero'?'block':'none';
      document.getElementById('rutasVariasCont').style.display=this.value==='varias'?'block':'none';
    });
  });

  document.getElementById('fNumRutas').addEventListener('input', generarRutas);
  document.getElementById('fNumAreas').addEventListener('input', generarAreas);

  // Total automático
  ['fVarones','fMujeres'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const v=parseInt(document.getElementById('fVarones').value)||0;
      const m=parseInt(document.getElementById('fMujeres').value)||0;
      document.getElementById('fTotal').value=(v+m)+' trabajadores';
    });
  });

  // Verificar retraso al cambiar fechas
  ['fFechaEjecucion','fFechaEnvio'].forEach(id => {
    document.getElementById(id).addEventListener('change', verificarRetrasoForm);
  });
}

function verificarRetrasoForm() {
  const fechaE=document.getElementById('fFechaEjecucion').value;
  const alertDiv=document.getElementById('obsAlert');
  if(!fechaE) { alertDiv.style.display='none'; return; }
  const {fechaLimite}=calcularFechaLimite(fechaE);
  const fLimite=new Date(fechaLimite+'T12:00:00');
  const fechaEnv=document.getElementById('fFechaEnvio').value;
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const hayRetraso=fechaEnv ? new Date(fechaEnv+'T12:00:00')>fLimite : hoy>fLimite;
  alertDiv.style.display=hayRetraso?'block':'none';
}

function generarRutas() {
  const n=Math.min(parseInt(document.getElementById('fNumRutas').value)||0, 50);
  const cont=document.getElementById('rutasItemsCont');
  if(n<1){cont.innerHTML='';return;}
  let html=`<div class="ruta-header"><span>#</span><span>Código de Ruta</span><span>Nombre de Ruta</span></div>`;
  for(let i=1;i<=n;i++){
    html+=`<div class="ruta-item-row"><div class="ruta-num">${i}</div>
      <input type="text" class="ruta-codigo" placeholder="Ej: RT-0${i}" maxlength="20"/>
      <input type="text" class="ruta-nombre" placeholder="Ej: Ruta Norte" maxlength="80"/></div>`;
  }
  cont.innerHTML=html;
}

function generarAreas() {
  const n=Math.min(parseInt(document.getElementById('fNumAreas').value)||0, 50);
  const cont=document.getElementById('areasItemsCont');
  if(n<1){cont.innerHTML='';return;}
  let html=`<div class="ruta-header"><span>#</span><span>Nombre del Área</span><span>N° Empleados</span></div>`;
  for(let i=1;i<=n;i++){
    html+=`<div class="ruta-item-row"><div class="ruta-num">${i}</div>
      <input type="text" class="area-nombre" placeholder="Ej: Administración" maxlength="80"/>
      <input type="number" class="area-cant" placeholder="0" min="0"/></div>`;
  }
  cont.innerHTML=html;
}

function obtenerRutas() {
  const tipo=document.querySelector('input[name="rutasModo"]:checked');
  if(!tipo) return {tipo:'ninguna',rutas:[]};
  if(tipo.value==='varias') return {tipo:'varias',rutas:[]};
  const rutas=[];
  document.querySelectorAll('.ruta-codigo').forEach((c,i) => {
    const n=document.querySelectorAll('.ruta-nombre')[i];
    if(c.value.trim()||n.value.trim()) rutas.push({codigo:c.value.trim(),nombre:n.value.trim()});
  });
  return {tipo:'detalle',rutas};
}

function obtenerAreas() {
  const areas=[];
  document.querySelectorAll('.area-nombre').forEach((a,i) => {
    const c=document.querySelectorAll('.area-cant')[i];
    if(a.value.trim()) areas.push({nombre:a.value.trim(),cantidad:parseInt(c.value)||0});
  });
  return areas;
}

// ─── BOTONES ──────────────────────────────────────────────────
function initBotones() {
  document.getElementById('btnPreview').addEventListener('click', mostrarPreview);
  document.getElementById('btnGuardar').addEventListener('click', guardarRegistro);
  document.getElementById('btnLimpiarForm').addEventListener('click', limpiarFormulario);
  document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
  document.getElementById('btnClearAll').addEventListener('click', borrarTodo);
  document.getElementById('btnRankPdf').addEventListener('click', exportRankingPDF);
  document.getElementById('btnStatsPdf').addEventListener('click', exportStatsPDF);
  document.getElementById('rankOrden').addEventListener('change', renderRanking);
  document.getElementById('statAnio').addEventListener('change', renderEstadisticas);
  // Modales click fuera
  document.getElementById('modalDetalle').addEventListener('click', function(e){if(e.target===this)cerrarDetalle();});
  document.getElementById('modalEnvio').addEventListener('click', function(e){if(e.target===this)cerrarEnvio();});
}

function mostrarPreview() {
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

async function guardarRegistro() {
  const supVal=document.getElementById('fSupervisor').value;
  const varones=document.getElementById('fVarones').value;
  const mujeres=document.getElementById('fMujeres').value;
  const tema=document.getElementById('fTema').value;
  const fechaE=document.getElementById('fFechaEjecucion').value;
  const fechaEnv=document.getElementById('fFechaEnvio').value;
  const obs=document.getElementById('fObservaciones').value.trim();
  if(!supVal||varones===''||mujeres===''||!tema||!fechaE){showToast('Completa todos los campos obligatorios (*).',true);return;}

  const tpEl=document.querySelector('input[name="tipoPersonal"]:checked');
  const tipoPersonal=tpEl?tpEl.value:'';
  const {fechaLimite,temporada}=calcularFechaLimite(fechaE);
  const fLimite=new Date(fechaLimite+'T12:00:00');
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const hayRetraso=fechaEnv ? new Date(fechaEnv+'T12:00:00')>fLimite : hoy>fLimite;
  if(hayRetraso && !obs) {
    showToast('⚠️ Hay RETRASO. Debes indicar el motivo en Observaciones.',false,true);
    document.getElementById('fObservaciones').focus();
    document.getElementById('obsAlert').style.display='block';
    return;
  }

  const [supervisor,sector]=supVal.split('|');
  const v=parseInt(varones)||0, m=parseInt(mujeres)||0;
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
    await addDoc(collection(db,COL),reg);
    showToast('✅ Registro guardado correctamente.',false);
    limpiarFormulario();
    document.querySelector('[data-tab="dashboard"]').click();
  } catch(e) {
    console.error(e);
    showToast('❌ Error al guardar. Verifica tu conexión.',true);
  }
}

function limpiarFormulario() {
  document.getElementById('etiForm').reset();
  document.getElementById('fSector').value='';
  document.getElementById('fTotal').value='0 trabajadores';
  document.getElementById('previewBox').style.display='none';
  document.getElementById('obsAlert').style.display='none';
  document.getElementById('bloqueTipoPersonal').style.display='none';
  document.getElementById('rutasCont').style.display='none';
  document.getElementById('areasCont').style.display='none';
  document.getElementById('rutasItemsCont').innerHTML='';
  document.getElementById('areasItemsCont').innerHTML='';
  document.getElementById('rutasNumeroCont').style.display='none';
  document.getElementById('rutasVariasCont').style.display='none';
  document.querySelectorAll('.radio-chip').forEach(c=>c.classList.remove('selected'));
}

// ─── DASHBOARD ────────────────────────────────────────────────
function renderDashboard() {
  const conEstado=registros.map(r=>({...r,...calcularEstado(r)}));
  const cumplidos=conEstado.filter(r=>r.estado==='cumplido').length;
  const proceso=conEstado.filter(r=>r.estado==='proceso').length;
  const retrasos=conEstado.filter(r=>r.estado==='leve'||r.estado==='critico').length;
  const totalTrab=conEstado.reduce((a,r)=>a+(r.total||0),0);
  const totalV=conEstado.reduce((a,r)=>a+(r.varones||0),0);
  const totalM=conEstado.reduce((a,r)=>a+(r.mujeres||0),0);
  const finalizados=cumplidos+retrasos;
  const pctCumpl=finalizados?Math.round((cumplidos/finalizados)*100):0;

  setText('kTotal',registros.length);
  setText('kTrabajadores',totalTrab.toLocaleString());
  setText('kVarones',totalV.toLocaleString());
  setText('kMujeres',totalM.toLocaleString());
  setText('kCumplidos',cumplidos);
  setText('kProceso',proceso);
  setText('kRetrasos',retrasos);
  setText('kCumplimiento',pctCumpl+'%');

  // Alertas
  const alertas=conEstado.filter(r=>r.estado==='leve'||r.estado==='critico'||( r.estado==='proceso'&&r.avance>=66));
  const aDiv=document.getElementById('dashAlertas');
  if(!alertas.length){aDiv.innerHTML='<p class="empty-msg">✅ Sin alertas activas. Todo al día.</p>';}
  else{
    aDiv.innerHTML=alertas.slice(0,8).map(r=>{
      if(r.estado==='proceso')
        return `<div class="alert-card alert-amarillo"><span class="alert-icon">⏰</span><div><strong>${esc(r.supervisor)}</strong> — ${esc(r.sector)}<br>Vence <strong>${formatDateDisplay(r.fechaLimite)}</strong> · Avance ${r.avance}% · ${esc(r.tema)}</div></div>`;
      const meta=ESTADO_META[r.estado];
      return `<div class="alert-card ${r.estado==='critico'?'alert-rojo':'alert-amarillo'}"><span class="alert-icon">${r.estado==='critico'?'🚨':'⚠️'}</span><div><strong>${esc(r.supervisor)}</strong> — ${esc(r.sector)}<br>${meta.label} · <strong>${r.diasRetraso} día(s) hábil(es)</strong> · Límite: ${formatDateDisplay(r.fechaLimite)}</div></div>`;
    }).join('');
  }

  // Últimos registros
  const uDiv=document.getElementById('dashUltimos');
  if(!registros.length){uDiv.innerHTML='<p class="empty-msg">Sin registros aún.</p>';}
  else{
    uDiv.innerHTML=conEstado.slice(0,6).map(r=>{
      const meta=ESTADO_META[r.estado];
      return `<div class="alert-card alert-azul" style="cursor:pointer;" onclick="verDetalle('${r.id}')"><span class="alert-icon">📚</span><div><strong>${esc(r.supervisor)}</strong> — ${esc(r.tema)}<br>${formatDateDisplay(r.fechaEjecucion)} · ${r.total} trabajadores · <span class="badge ${meta.badge}">${meta.label}</span></div></div>`;
    }).join('');
  }

  // Avance por supervisor
  renderAvanceSupervisores(conEstado);

  // Charts
  renderChartsDashboard(cumplidos,proceso,conEstado);
}

function renderAvanceSupervisores(conEstado) {
  const div=document.getElementById('dashSupervisores');
  const porSup={};
  conEstado.forEach(r=>{
    const key=r.supervisor;
    if(!porSup[key])porSup[key]={total:0,cumplidos:0,retrasos:0,proceso:0,trabajadores:0};
    porSup[key].total++;
    porSup[key].trabajadores+=r.total||0;
    if(r.estado==='cumplido')porSup[key].cumplidos++;
    else if(r.estado==='proceso')porSup[key].proceso++;
    else porSup[key].retrasos++;
  });
  const sups=Object.entries(porSup).sort((a,b)=>b[1].total-a[1].total);
  if(!sups.length){div.innerHTML='<p class="empty-msg">Sin datos.</p>';return;}
  div.innerHTML=sups.map(([nombre,d])=>{
    const finalizados=d.cumplidos+d.retrasos;
    const pct=finalizados?Math.round((d.cumplidos/finalizados)*100):0;
    const fillClass=pct>=80?'pf-verde':pct>=50?'pf-amarillo':'pf-rojo';
    return `<div style="margin-bottom:13px;">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:4px;">
        <span>${esc(nombre)} <span style="color:var(--gris-muted);font-weight:400;">· ${d.total} cap. · ${d.trabajadores} trab.</span></span>
        <span style="color:${pct>=80?'#1a8040':pct>=50?'#c89010':'#cc0000'};">${pct}% cumplimiento</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderChartsDashboard(cumplidos,proceso,conEstado) {
  const leves=conEstado.filter(r=>r.estado==='leve').length;
  const criticos=conEstado.filter(r=>r.estado==='critico').length;

  if(chEstados){chEstados.data.datasets[0].data=[cumplidos,proceso,leves,criticos];chEstados.update('none');}
  else{chEstados=new Chart(document.getElementById('chEstados'),{type:'doughnut',
    data:{labels:['Cumplido','En Proceso','Retraso Leve','Retraso Crítico'],datasets:[{data:[cumplidos,proceso,leves,criticos],backgroundColor:['#1a8040','#0050c8','#c89010','#cc0000'],borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}},cutout:'58%'}});}

  // Tendencia mensual (últimos 6 meses)
  const mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const byMonth={};
  registros.forEach(r=>{
    const d=new Date(r.fechaEjecucion+'T12:00:00');
    const key=d.getFullYear()*100+d.getMonth();
    if(!byMonth[key])byMonth[key]={caps:0,trab:0,mes:d.getMonth(),anio:d.getFullYear()};
    byMonth[key].caps++;byMonth[key].trab+=r.total||0;
  });
  const keys=Object.keys(byMonth).sort((a,b)=>a-b).slice(-6);
  const labels=keys.map(k=>mn[byMonth[k].mes]+' '+String(byMonth[k].anio).slice(2));
  const dataCaps=keys.map(k=>byMonth[k].caps);
  if(chTendencia){chTendencia.data.labels=labels;chTendencia.data.datasets[0].data=dataCaps;chTendencia.update('none');}
  else{chTendencia=new Chart(document.getElementById('chTendencia'),{type:'line',
    data:{labels,datasets:[{label:'Capacitaciones',data:dataCaps,borderColor:'#0050c8',backgroundColor:'rgba(0,80,200,.09)',tension:.4,fill:true,pointRadius:5,pointBackgroundColor:'#0050c8'}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});}
}

// ─── TABLA / FILTROS ──────────────────────────────────────────
function initFiltros() {
  ['filtBusqueda','filtSupervisor','filtEstado','filtTema','filtMes'].forEach(id => {
    const el=document.getElementById(id);
    el.addEventListener(id==='filtBusqueda'?'input':'change', renderTabla);
  });
}

function poblarFiltros() {
  // Supervisores únicos
  const sups=[...new Set(registros.map(r=>r.supervisor))].sort();
  const selSup=document.getElementById('filtSupervisor');
  const curSup=selSup.value;
  selSup.innerHTML='<option value="">Todos los supervisores</option>'+sups.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  selSup.value=curSup;
  // Meses únicos
  const mn=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const meses=[...new Set(registros.map(r=>{const d=new Date(r.fechaEjecucion+'T12:00:00');return d.getFullYear()*100+d.getMonth();}))].sort((a,b)=>b-a);
  const selMes=document.getElementById('filtMes');
  const curMes=selMes.value;
  selMes.innerHTML='<option value="">Todos los meses</option>'+meses.map(m=>`<option value="${m}">${mn[m%100]} ${Math.floor(m/100)}</option>`).join('');
  selMes.value=curMes;
}

function renderTabla() {
  poblarFiltros();
  const busq=document.getElementById('filtBusqueda').value.trim().toLowerCase();
  const fSup=document.getElementById('filtSupervisor').value;
  const fEst=document.getElementById('filtEstado').value;
  const fTem=document.getElementById('filtTema').value;
  const fMes=document.getElementById('filtMes').value;

  let data=registros.map(r=>({...r,...calcularEstado(r)}));
  if(busq)data=data.filter(r=>(r.supervisor+' '+r.sector+' '+r.tema+' '+(r.observaciones||'')).toLowerCase().includes(busq));
  if(fSup)data=data.filter(r=>r.supervisor===fSup);
  if(fEst)data=data.filter(r=>r.estado===fEst);
  if(fTem)data=data.filter(r=>r.tema===fTem);
  if(fMes){const m=parseInt(fMes);data=data.filter(r=>{const d=new Date(r.fechaEjecucion+'T12:00:00');return d.getFullYear()*100+d.getMonth()===m;});}

  document.getElementById('resumenFiltro').textContent=`Mostrando ${data.length} de ${registros.length} registros · ${data.reduce((a,r)=>a+(r.total||0),0)} trabajadores`;

  const tbody=document.getElementById('tbodyRegistros');
  if(!data.length){tbody.innerHTML='<tr><td colspan="15" class="empty-msg">Sin registros que coincidan con los filtros.</td></tr>';return;}

  const esAdmin=usuarioActual&&usuarioActual.rol==='admin';
  tbody.innerHTML=data.map((r,i)=>{
    const meta=ESTADO_META[r.estado];
    const pct=r.estado==='cumplido'?100:r.estado==='proceso'?r.avance:r.retraso;
    const fillClass=r.estado==='cumplido'?'pf-verde':r.estado==='proceso'?'pf-azul':r.estado==='leve'?'pf-amarillo':'pf-rojo';
    const pctLabel=r.estado==='proceso'?`${r.avance}% avance`:r.estado==='cumplido'?'100%':`${r.retraso}% retraso`;
    const tipoIcon=r.tipoPersonal==='OBREROS'?'🌾':r.tipoPersonal==='EMPLEADOS'?'💼':'–';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(r.supervisor)}</strong></td>
      <td style="font-size:10.5px;">${esc(r.sector||'')}</td>
      <td style="font-size:10.5px;">${esc(r.tema)}</td>
      <td style="text-align:center;">${tipoIcon}</td>
      <td>${r.varones||0}</td>
      <td>${r.mujeres||0}</td>
      <td><strong>${r.total||0}</strong></td>
      <td>${formatDateDisplay(r.fechaEjecucion)}</td>
      <td style="color:var(--rojo);font-weight:700;">${formatDateDisplay(r.fechaLimite)}</td>
      <td>${r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'<span class="badge badge-gris">Pendiente</span>'}</td>
      <td class="progress-cell">
        <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${Math.min(pct,100)}%"></div></div>
        <div class="progress-label" style="color:${meta.color};">${pctLabel}</div>
      </td>
      <td><span class="badge ${meta.badge}">${meta.label}</span></td>
      <td style="max-width:130px;font-size:10px;">${esc((r.observaciones||'').substring(0,45))}${(r.observaciones||'').length>45?'…':''}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="verDetalle('${r.id}')" title="Ver detalle">👁️</button>
        ${!r.fechaEnvio?`<button class="btn btn-primary btn-sm" onclick="abrirEnvio('${r.id}')" title="Registrar envío">📤</button>`:''}
        ${esAdmin?`<button class="btn btn-danger btn-sm" onclick="eliminarRegistro('${r.id}')" title="Eliminar">🗑</button>`:''}
      </td>
    </tr>`;
  }).join('');
}

// ─── DETALLE ──────────────────────────────────────────────────
window.verDetalle=function(id) {
  const r=registros.find(x=>x.id===id);
  if(!r)return;
  const est=calcularEstado(r);
  const meta=ESTADO_META[est.estado];
  let rutasHtml='';
  if(r.rutasTipo==='varias')rutasHtml='<div class="det-item full"><div class="det-label">Rutas</div><div class="det-value">📦 Varias rutas (sin detalle)</div></div>';
  else if(r.rutas&&r.rutas.length)rutasHtml=`<div class="det-item full"><div class="det-label">Rutas (${r.rutas.length})</div><div class="det-value" style="font-weight:400;font-size:11.5px;">${r.rutas.map(x=>`<span class="badge badge-azul" style="margin:2px;">${esc(x.codigo)} ${esc(x.nombre)}</span>`).join('')}</div></div>`;
  let areasHtml='';
  if(r.areas&&r.areas.length)areasHtml=`<div class="det-item full"><div class="det-label">Áreas (${r.areas.length})</div><div class="det-value" style="font-weight:400;font-size:11.5px;">${r.areas.map(x=>`<span class="badge badge-azul" style="margin:2px;">${esc(x.nombre)}: ${x.cantidad}</span>`).join('')}</div></div>`;

  document.getElementById('detalleContent').innerHTML=`
    <div class="det-grid">
      <div class="det-item"><div class="det-label">Supervisor</div><div class="det-value">${esc(r.supervisor)}</div></div>
      <div class="det-item"><div class="det-label">Sector</div><div class="det-value">${esc(r.sector||'–')}</div></div>
      <div class="det-item"><div class="det-label">Tema</div><div class="det-value">${esc(r.tema)}</div></div>
      <div class="det-item"><div class="det-label">Tipo de Personal</div><div class="det-value">${r.tipoPersonal==='OBREROS'?'🌾 Obreros':r.tipoPersonal==='EMPLEADOS'?'💼 Empleados':'–'}</div></div>
      <div class="det-item"><div class="det-label">Varones / Mujeres</div><div class="det-value">${r.varones||0} ♂ · ${r.mujeres||0} ♀</div></div>
      <div class="det-item"><div class="det-label">Total Capacitados</div><div class="det-value">${r.total||0} trabajadores</div></div>
      <div class="det-item"><div class="det-label">Fecha de Ejecución</div><div class="det-value">${formatDateDisplay(r.fechaEjecucion)}</div></div>
      <div class="det-item"><div class="det-label">Fecha Límite (3 días hábiles)</div><div class="det-value" style="color:var(--rojo);">${formatDateDisplay(r.fechaLimite)}</div></div>
      <div class="det-item"><div class="det-label">Fecha de Envío</div><div class="det-value">${r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'Pendiente'}</div></div>
      <div class="det-item"><div class="det-label">Temporada</div><div class="det-value">${r.temporada==='alta'?'🌡 Alta (Lun-Sáb)':'❄ Baja (Lun-Vie)'}</div></div>
      <div class="det-item"><div class="det-label">Estado</div><div class="det-value"><span class="badge ${meta.badge}">${meta.label}</span>${est.diasRetraso?` · ${est.diasRetraso} día(s)`:''}</div></div>
      <div class="det-item"><div class="det-label">Registrado por</div><div class="det-value">${esc(r.registradoPor||'–')}</div></div>
      ${rutasHtml}${areasHtml}
      ${r.observaciones?`<div class="det-item full"><div class="det-label">Observaciones</div><div class="det-value" style="font-weight:400;">${esc(r.observaciones)}</div></div>`:''}
    </div>`;
  document.getElementById('modalDetalle').classList.add('open');
};
window.cerrarDetalle=function(){document.getElementById('modalDetalle').classList.remove('open');};

// ─── ENVÍO DE ACTAS ───────────────────────────────────────────
window.abrirEnvio=function(id) {
  document.getElementById('envioRegId').value=id;
  document.getElementById('envioFecha').value=formatDate(new Date());
  document.getElementById('envioObs').value='';
  document.getElementById('modalEnvio').classList.add('open');
};
window.cerrarEnvio=function(){document.getElementById('modalEnvio').classList.remove('open');};

window.guardarEnvio=async function() {
  const id=document.getElementById('envioRegId').value;
  const fecha=document.getElementById('envioFecha').value;
  const obs=document.getElementById('envioObs').value.trim();
  if(!fecha){showToast('Ingresa la fecha de envío',true);return;}
  const r=registros.find(x=>x.id===id);
  if(!r)return;
  const fLimite=new Date(r.fechaLimite+'T12:00:00');
  const hayRetraso=new Date(fecha+'T12:00:00')>fLimite;
  if(hayRetraso&&!obs&&!(r.observaciones||'').trim()){
    showToast('⚠️ El envío tiene RETRASO. Indica el motivo en observaciones.',false,true);
    document.getElementById('envioObs').focus();
    return;
  }
  try{
    const cambios={fechaEnvio:fecha};
    if(obs)cambios.observaciones=(r.observaciones?r.observaciones+' | ':'')+obs;
    await updateDoc(doc(db,COL,id),cambios);
    cerrarEnvio();
    showToast('✅ Envío de actas registrado.');
  }catch(e){showToast('❌ Error al guardar.',true);}
};

// ─── ELIMINAR ─────────────────────────────────────────────────
window.eliminarRegistro=async function(id) {
  if(usuarioActual?.rol!=='admin'){showToast('Solo administradores pueden eliminar.',true);return;}
  if(!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.'))return;
  try{
    await deleteDoc(doc(db,COL,id));
    showToast('🗑 Registro eliminado.');
  }catch(e){showToast('❌ Error al eliminar.',true);}
};

async function borrarTodo() {
  if(usuarioActual?.rol!=='admin')return;
  if(!confirm('⚠️ ¿BORRAR TODOS los registros? Esta acción es IRREVERSIBLE.'))return;
  if(!confirm('Confirma nuevamente: se eliminarán TODOS los registros de la nube.'))return;
  try{
    const snap=await getDocs(collection(db,COL));
    for(const d of snap.docs)await deleteDoc(doc(db,COL,d.id));
    showToast('🗑 Todos los registros fueron eliminados.');
  }catch(e){showToast('❌ Error.',true);}
}

// ─── EXCEL ────────────────────────────────────────────────────
function exportarExcel() {
  if(!registros.length){showToast('Sin datos para exportar',true);return;}
  const data=registros.map(r=>{
    const est=calcularEstado(r);
    return{
      'Supervisor':r.supervisor,'Sector':r.sector||'','Tema':r.tema,
      'Tipo Personal':r.tipoPersonal||'','Varones':r.varones||0,'Mujeres':r.mujeres||0,'Total':r.total||0,
      'Fecha Ejecución':r.fechaEjecucion,'Fecha Límite':r.fechaLimite,'Fecha Envío':r.fechaEnvio||'PENDIENTE',
      'Temporada':r.temporada,'Estado':ESTADO_META[est.estado].label.replace(/^[^\s]+\s/,''),
      'Días Retraso':est.diasRetraso||0,'% Avance':est.estado==='proceso'?est.avance:est.estado==='cumplido'?100:0,
      'Rutas':r.rutasTipo==='varias'?'VARIAS':(r.rutas||[]).map(x=>x.codigo+' '+x.nombre).join('; '),
      'Áreas':(r.areas||[]).map(x=>x.nombre+': '+x.cantidad).join('; '),
      'Observaciones':r.observaciones||'','Registrado Por':r.registradoPor||''
    };
  });
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Capacitaciones ETI');
  XLSX.writeFile(wb,`ETI_Registros_${formatDate(new Date())}.xlsx`);
  showToast('📥 Excel exportado.');
}

// ─── RANKING ──────────────────────────────────────────────────
function calcularRanking() {
  const conEstado=registros.map(r=>({...r,...calcularEstado(r)}));
  const porSup={};
  conEstado.forEach(r=>{
    if(!porSup[r.supervisor])porSup[r.supervisor]={nombre:r.supervisor,sector:r.sector,total:0,cumplidos:0,retrasos:0,proceso:0,trabajadores:0,varones:0,mujeres:0};
    const s=porSup[r.supervisor];
    s.total++;s.trabajadores+=r.total||0;s.varones+=r.varones||0;s.mujeres+=r.mujeres||0;
    if(r.estado==='cumplido')s.cumplidos++;
    else if(r.estado==='proceso')s.proceso++;
    else s.retrasos++;
  });
  return Object.values(porSup).map(s=>{
    const fin=s.cumplidos+s.retrasos;
    return{...s,cumplimiento:fin?Math.round((s.cumplidos/fin)*100):0};
  });
}

function renderRanking() {
  const ranking=calcularRanking();
  const orden=document.getElementById('rankOrden').value;
  ranking.sort((a,b)=>orden==='total'?b.total-a.total:orden==='trabajadores'?b.trabajadores-a.trabajadores:b.cumplimiento-a.cumplimiento||b.total-a.total);

  // KPIs
  if(ranking.length){
    const conDatos=ranking.filter(r=>r.cumplidos+r.retrasos>0);
    const mejor=conDatos.length?[...conDatos].sort((a,b)=>b.cumplimiento-a.cumplimiento)[0]:null;
    const peor=conDatos.length?[...conDatos].sort((a,b)=>a.cumplimiento-b.cumplimiento)[0]:null;
    setText('rkMejor',mejor?mejor.nombre.split(' ').slice(0,2).join(' '):'–');
    setText('rkPeor',peor&&peor.cumplimiento<100?peor.nombre.split(' ').slice(0,2).join(' '):'–');
    const prom=conDatos.length?Math.round(conDatos.reduce((a,r)=>a+r.cumplimiento,0)/conDatos.length):0;
    setText('rkPromedio',prom+'%');
  }

  const div=document.getElementById('rankingLista');
  if(!ranking.length){div.innerHTML='<p class="empty-msg">Sin registros para rankear.</p>';return;}
  div.innerHTML=ranking.map((r,i)=>{
    const posClass=i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const posLabel=i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
    const color=r.cumplimiento>=80?'#1a8040':r.cumplimiento>=50?'#c89010':'#cc0000';
    const fillClass=r.cumplimiento>=80?'pf-verde':r.cumplimiento>=50?'pf-amarillo':'pf-rojo';
    return `<div class="rank-item">
      <div class="rank-pos ${posClass}">${posLabel}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(r.nombre)}</div>
        <div class="rank-sub">${r.total} capacitaciones · ${r.trabajadores.toLocaleString()} trabajadores (${r.varones}♂ ${r.mujeres}♀) · ✅${r.cumplidos} ⏳${r.proceso} 🚨${r.retrasos}</div>
      </div>
      <div class="rank-bar">
        <div class="progress-track"><div class="progress-fill ${fillClass}" style="width:${r.cumplimiento}%"></div></div>
      </div>
      <div class="rank-score">
        <div class="rank-pct" style="color:${color};">${r.cumplimiento}%</div>
        <div class="rank-detail">cumplimiento</div>
      </div>
    </div>`;
  }).join('');
}

function exportRankingPDF() {
  const ranking=calcularRanking().sort((a,b)=>b.cumplimiento-a.cumplimiento||b.total-a.total);
  if(!ranking.length){showToast('Sin datos',true);return;}
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('l','mm','a4');
  pdf.setFontSize(15);pdf.setTextColor(0,26,94);
  pdf.text('RANKING DE SUPERVISORES — CAPACITACIONES ETI · VERFRUT',15,16);
  pdf.setFontSize(9);pdf.setTextColor(80,80,80);
  pdf.text(`Generado: ${formatDateDisplay(formatDate(new Date()))} · Sistema ETI v5.0`,15,23);
  pdf.setDrawColor(0,80,200);pdf.line(15,26,282,26);
  let y=34;
  pdf.setFontSize(9.5);
  ranking.forEach((r,i)=>{
    if(y>190){pdf.addPage();y=16;}
    pdf.setTextColor(20,20,20);pdf.setFont(undefined,'bold');
    pdf.text(`${i+1}. ${r.nombre}`,15,y);
    pdf.setFont(undefined,'normal');pdf.setTextColor(80,80,80);
    pdf.text(`${r.total} capacitaciones · ${r.trabajadores} trabajadores · Cumplidos: ${r.cumplidos} · Retrasos: ${r.retrasos} · Cumplimiento: ${r.cumplimiento}%`,15,y+5);
    y+=13;
  });
  pdf.save(`Ranking_ETI_${formatDate(new Date())}.pdf`);
  showToast('📄 PDF descargado.');
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────
function poblarAnios() {
  const anios=[...new Set(registros.map(r=>new Date(r.fechaEjecucion+'T12:00:00').getFullYear()))].sort((a,b)=>b-a);
  const sel=document.getElementById('statAnio');
  const cur=sel.value;
  sel.innerHTML='<option value="">Todos los años</option>'+anios.map(a=>`<option value="${a}">${a}</option>`).join('');
  if(cur&&anios.includes(parseInt(cur)))sel.value=cur;
}

function renderEstadisticas() {
  poblarAnios();
  const anio=document.getElementById('statAnio').value;
  let data=registros.map(r=>({...r,...calcularEstado(r)}));
  if(anio)data=data.filter(r=>new Date(r.fechaEjecucion+'T12:00:00').getFullYear()===parseInt(anio));

  const cumplidos=data.filter(r=>r.estado==='cumplido').length;
  const retrasos=data.filter(r=>r.estado==='leve'||r.estado==='critico').length;
  const fin=cumplidos+retrasos;
  const totalTrab=data.reduce((a,r)=>a+(r.total||0),0);

  // Días promedio de envío
  const conEnvio=data.filter(r=>r.fechaEnvio);
  const diasProm=conEnvio.length?(conEnvio.reduce((a,r)=>{
    return a+contarDiasHabiles(new Date(r.fechaEjecucion+'T12:00:00'),new Date(r.fechaEnvio+'T12:00:00'));
  },0)/conEnvio.length).toFixed(1):0;

  // Meses activos para promedio
  const mesesActivos=new Set(data.map(r=>{const d=new Date(r.fechaEjecucion+'T12:00:00');return d.getFullYear()*100+d.getMonth();})).size;

  setText('sTotal',data.length);
  setText('sTrabajadores',totalTrab.toLocaleString());
  setText('sCumplimiento',(fin?Math.round((cumplidos/fin)*100):0)+'%');
  setText('sPromedio',mesesActivos?Math.round(data.length/mesesActivos*10)/10:0);
  setText('sRetrasos',retrasos);
  setText('sDiasProm',diasProm);

  renderChartsStats(data);
}

function renderChartsStats(data) {
  const mn=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const optBase={responsive:true,maintainAspectRatio:false,animation:{duration:300}};

  // 1. Estados
  const est={cumplido:0,proceso:0,leve:0,critico:0};
  data.forEach(r=>est[r.estado]++);
  const dEst=[est.cumplido,est.proceso,est.leve,est.critico];
  if(stEstados){stEstados.data.datasets[0].data=dEst;stEstados.update('none');}
  else{stEstados=new Chart(document.getElementById('stEstados'),{type:'doughnut',data:{labels:['Cumplido','En Proceso','R. Leve','R. Crítico'],datasets:[{data:dEst,backgroundColor:['#1a8040','#0050c8','#c89010','#cc0000'],borderWidth:0}]},options:{...optBase,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}},cutout:'58%'}});}

  // 2. Temas
  const temas={};data.forEach(r=>{temas[r.tema]=(temas[r.tema]||0)+1;});
  const tKeys=Object.keys(temas);
  if(stTemas){stTemas.data.labels=tKeys;stTemas.data.datasets[0].data=tKeys.map(k=>temas[k]);stTemas.update('none');}
  else{stTemas=new Chart(document.getElementById('stTemas'),{type:'pie',data:{labels:tKeys,datasets:[{data:tKeys.map(k=>temas[k]),backgroundColor:['#0050c8','#e07a2a','#6a4c93'],borderWidth:0}]},options:{...optBase,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}}}});}

  // 3. Por supervisor (caps)
  const sup={};data.forEach(r=>{const n=r.supervisor.split(' ').slice(0,2).join(' ');sup[n]=(sup[n]||0)+1;});
  const sKeys=Object.keys(sup).sort((a,b)=>sup[b]-sup[a]);
  if(stSupervisores){stSupervisores.data.labels=sKeys;stSupervisores.data.datasets[0].data=sKeys.map(k=>sup[k]);stSupervisores.update('none');}
  else{stSupervisores=new Chart(document.getElementById('stSupervisores'),{type:'bar',data:{labels:sKeys,datasets:[{data:sKeys.map(k=>sup[k]),backgroundColor:'#0050c8',borderRadius:6}]},options:{...optBase,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});}

  // 4. Trabajadores por supervisor
  const supT={};data.forEach(r=>{const n=r.supervisor.split(' ').slice(0,2).join(' ');supT[n]=(supT[n]||0)+(r.total||0);});
  const stKeys=Object.keys(supT).sort((a,b)=>supT[b]-supT[a]);
  if(stTrabajadores){stTrabajadores.data.labels=stKeys;stTrabajadores.data.datasets[0].data=stKeys.map(k=>supT[k]);stTrabajadores.update('none');}
  else{stTrabajadores=new Chart(document.getElementById('stTrabajadores'),{type:'bar',data:{labels:stKeys,datasets:[{data:stKeys.map(k=>supT[k]),backgroundColor:'#e8b94a',borderRadius:6}]},options:{...optBase,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}});}

  // 5. Mensual dual
  const byM={};data.forEach(r=>{const d=new Date(r.fechaEjecucion+'T12:00:00');const k=d.getFullYear()*100+d.getMonth();if(!byM[k])byM[k]={caps:0,trab:0,mes:d.getMonth(),anio:d.getFullYear()};byM[k].caps++;byM[k].trab+=r.total||0;});
  const mKeys=Object.keys(byM).sort((a,b)=>a-b);
  const mLabels=mKeys.map(k=>mn[byM[k].mes]+' '+String(byM[k].anio).slice(2));
  if(stMensual){stMensual.data.labels=mLabels;stMensual.data.datasets[0].data=mKeys.map(k=>byM[k].caps);stMensual.data.datasets[1].data=mKeys.map(k=>byM[k].trab);stMensual.update('none');}
  else{stMensual=new Chart(document.getElementById('stMensual'),{type:'bar',data:{labels:mLabels,datasets:[
    {label:'Capacitaciones',data:mKeys.map(k=>byM[k].caps),backgroundColor:'#0050c8',borderRadius:5,yAxisID:'y'},
    {label:'Trabajadores',data:mKeys.map(k=>byM[k].trab),type:'line',borderColor:'#e07a2a',backgroundColor:'rgba(224,122,42,.12)',tension:.4,pointRadius:4,yAxisID:'y1'}
  ]},options:{...optBase,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}},scales:{y:{beginAtZero:true,position:'left',ticks:{precision:0}},y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false},ticks:{precision:0}}}}});}

  // 6. Temporada
  const temp={alta:0,baja:0};data.forEach(r=>temp[r.temporada]++);
  if(stTemporada){stTemporada.data.datasets[0].data=[temp.alta,temp.baja];stTemporada.update('none');}
  else{stTemporada=new Chart(document.getElementById('stTemporada'),{type:'bar',data:{labels:['🌡 Alta','❄ Baja'],datasets:[{data:[temp.alta,temp.baja],backgroundColor:['#e07a2a','#1a6fd4'],borderRadius:8}]},options:{...optBase,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});}

  // 7. Obreros vs Empleados
  const pers={OBREROS:0,EMPLEADOS:0,OTRO:0};
  data.forEach(r=>{if(r.tipoPersonal==='OBREROS')pers.OBREROS+=r.total||0;else if(r.tipoPersonal==='EMPLEADOS')pers.EMPLEADOS+=r.total||0;else pers.OTRO+=r.total||0;});
  const pLabels=['🌾 Obreros','💼 Empleados'];const pData=[pers.OBREROS,pers.EMPLEADOS];
  if(pers.OTRO>0){pLabels.push('Sin clasificar');pData.push(pers.OTRO);}
  if(stPersonal){stPersonal.data.labels=pLabels;stPersonal.data.datasets[0].data=pData;stPersonal.update('none');}
  else{stPersonal=new Chart(document.getElementById('stPersonal'),{type:'doughnut',data:{labels:pLabels,datasets:[{data:pData,backgroundColor:['#1a8040','#0050c8','#9aaabb'],borderWidth:0}]},options:{...optBase,plugins:{legend:{position:'bottom',labels:{font:{family:'Tahoma',size:10}}}},cutout:'58%'}});}
}

function exportStatsPDF() {
  const anio=document.getElementById('statAnio').value;
  let data=registros.map(r=>({...r,...calcularEstado(r)}));
  if(anio)data=data.filter(r=>new Date(r.fechaEjecucion+'T12:00:00').getFullYear()===parseInt(anio));
  if(!data.length){showToast('Sin datos',true);return;}

  const cumplidos=data.filter(r=>r.estado==='cumplido').length;
  const proceso=data.filter(r=>r.estado==='proceso').length;
  const retrasos=data.filter(r=>r.estado==='leve'||r.estado==='critico').length;
  const fin=cumplidos+retrasos;
  const totalTrab=data.reduce((a,r)=>a+(r.total||0),0);
  const totalV=data.reduce((a,r)=>a+(r.varones||0),0);
  const totalM=data.reduce((a,r)=>a+(r.mujeres||0),0);

  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  pdf.setFontSize(15);pdf.setTextColor(0,26,94);
  pdf.text('REPORTE GERENCIAL — CAPACITACIONES ETI',15,18);
  pdf.setFontSize(10);pdf.setTextColor(80,80,80);
  pdf.text(`Verfrut · Relaciones Laborales · ${anio||'Todos los años'} · Generado: ${formatDateDisplay(formatDate(new Date()))}`,15,25);
  pdf.setDrawColor(0,80,200);pdf.line(15,29,195,29);

  let y=40;
  pdf.setFontSize(12);pdf.setTextColor(0,48,135);pdf.setFont(undefined,'bold');
  pdf.text('1. RESUMEN GENERAL',15,y);y+=8;
  pdf.setFontSize(10);pdf.setTextColor(40,40,40);pdf.setFont(undefined,'normal');
  [
    `Total de capacitaciones: ${data.length}`,
    `Trabajadores capacitados: ${totalTrab.toLocaleString()} (${totalV} varones · ${totalM} mujeres)`,
    `Cumplidos: ${cumplidos} · En proceso: ${proceso} · Con retraso: ${retrasos}`,
    `Porcentaje de cumplimiento: ${fin?Math.round((cumplidos/fin)*100):0}%`
  ].forEach(line=>{pdf.text(line,18,y);y+=6.5;});

  y+=6;
  pdf.setFontSize(12);pdf.setTextColor(0,48,135);pdf.setFont(undefined,'bold');
  pdf.text('2. DESEMPEÑO POR SUPERVISOR',15,y);y+=8;
  pdf.setFontSize(9.5);pdf.setFont(undefined,'normal');
  const ranking=calcularRanking().sort((a,b)=>b.cumplimiento-a.cumplimiento);
  ranking.forEach((r,i)=>{
    if(y>270){pdf.addPage();y=18;}
    pdf.setTextColor(20,20,20);pdf.setFont(undefined,'bold');
    pdf.text(`${i+1}. ${r.nombre}`,18,y);
    pdf.setFont(undefined,'normal');pdf.setTextColor(90,90,90);
    pdf.text(`${r.total} cap. · ${r.trabajadores} trab. · Cumplimiento ${r.cumplimiento}%`,18,y+4.5);
    y+=11;
  });

  y+=5;
  if(y>250){pdf.addPage();y=18;}
  pdf.setFontSize(12);pdf.setTextColor(0,48,135);pdf.setFont(undefined,'bold');
  pdf.text('3. REGISTROS CON RETRASO',15,y);y+=8;
  pdf.setFontSize(9);pdf.setFont(undefined,'normal');
  const conRetraso=data.filter(r=>r.estado==='leve'||r.estado==='critico');
  if(!conRetraso.length){pdf.setTextColor(26,128,64);pdf.text('✓ Sin registros con retraso.',18,y);}
  else conRetraso.forEach(r=>{
    if(y>270){pdf.addPage();y=18;}
    pdf.setTextColor(150,20,20);
    pdf.text(`• ${r.supervisor} — ${r.tema} — Ejecución: ${r.fechaEjecucion} — ${r.diasRetraso} día(s) hábil(es) de retraso`,18,y);
    y+=6;
  });

  pdf.save(`Reporte_ETI_${anio||'completo'}_${formatDate(new Date())}.pdf`);
  showToast('📄 Reporte PDF descargado.');
}

// ─── UTILS ────────────────────────────────────────────────────
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function formatDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function formatDateDisplay(str){
  if(!str)return'–';
  try{
    const[y,m,d]=str.split('-');
    const mn=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return`${d}/${mn[parseInt(m)-1]}/${y}`;
  }catch{return str;}
}
function esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg,isError=false,isWarn=false){
  const e=document.querySelector('.toast');if(e)e.remove();
  const t=document.createElement('div');
  t.className='toast'+(isError?' error':isWarn?'':' ok');
  if(isWarn)t.style.background='#c89010';
  t.innerHTML=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},5000);
}
