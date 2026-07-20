// ════════════════════════════════════════════════
//  SISTEMA ETI v6.0 — VERFRUT · RAPEL
//  Capacitaciones de Ética e Integridad
//  Firebase Firestore · Chart.js · SheetJS · jsPDF
//  v6: diseño corporativo, alertas de vencimiento,
//      módulo de supervisores y sincronización Sheets
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
const COL_SUPS = 'supervisores_eti';
const COL_PROG = 'programaciones_eti';
const COL_USERS = 'usuarios_eti';

// ─── ENLACE AL SISTEMA DE RR.LL. ──────────────────────────────
// Cuando tengas la URL de tu sistema de Relaciones Laborales
// (por ejemplo la web app de Apps Script), pégala entre las comillas.
// Si está vacía, el botón "Sistema RR.LL" no se muestra.
const URL_SISTEMA_RRLL = 'https://joeltimoteog-bot.github.io/sistema-rl-verfrut/index.html';

// Seed inicial de supervisores (solo si la colección está vacía)
const SUPS_SEED = [
  {nombre:'POOL TAMAYO RODRIGUEZ', sector:'SECTOR EL PAPAYO'},
  {nombre:'POOL TAMAYO RODRIGUEZ', sector:'SECTOR LIMONES'},
  {nombre:'ALEX TINEO RAMOS', sector:'SECTOR OLIVARES BAJO'},
  {nombre:'FLOR PULACHE VIERA', sector:'SECTOR LOS OLIVARES'},
  {nombre:'ALEX ZAPATA JUAREZ', sector:'SECTOR APROA'},
  {nombre:'YHANELLY LUZON VENEGA', sector:'SECTOR SANTA ROSA'},
  {nombre:'ALEXANDER MARTINEZ JUAREZ', sector:'SECTOR PUNTA ARENAS'},
  {nombre:'SERGIO VIERA GIRON', sector:'SECTOR ALGARROBOS'},
  {nombre:'ELBERTH CASTRO BAYONA', sector:'SECTOR SAN VICENTE'}
];

// ─── USUARIOS ─────────────────────────────────────────────────
const USUARIOS = [
  { usuario:'jtimoteo',  nombre:'Joel A. Timoteo Gonza',   password:'jtimoteo2026',  rol:'admin'   },
  { usuario:'ovilela',   nombre:'Olga Vilela Ludeña',      password:'ovilela2026',   rol:'usuario' },
  { usuario:'jchavez',   nombre:'Jorge Chavez Cordova',    password:'jchavez2026',   rol:'usuario' },
  { usuario:'gcastillo', nombre:'Lucia Castillo Gonzalez', password:'gcastillo2026', rol:'usuario' },
  { usuario:'lcastillo', nombre:'L. Castillo',             password:'lcastillo2026', rol:'usuario' },
  { usuario:'tmendoza',  nombre:'T. Mendoza',              password:'tmendoza2026',  rol:'usuario' }
];

const FESTIVOS_PERU = ['01-01','04-17','04-18','05-01','06-29','07-28','07-29','08-30','10-08','11-01','12-08','12-09','12-25'];

let registros = [];
let supervisores = [];
let programaciones = [];
let usuariosCuentas = [];
let usuarioActual = null;
let unsubscribe = null;
let unsubSups = null;
let unsubProg = null;
let unsubUsers = null;
let uiInicializada = false;
let resumenMostrado = false;
let avisoSupMostrado = false;
let dataRegsCargada = false;
let dataProgCargada = false;
let chEstados=null, chTendencia=null;
let stEstados=null, stTemas=null, stSupervisores=null, stTrabajadores=null, stMensual=null, stTemporada=null, stPersonal=null;

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  aplicarLinkRRLL();
  document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
});

// ─── LOGIN ────────────────────────────────────────────────────
function initLogin() {
  document.getElementById('btnLogin').addEventListener('click', intentarLogin);
  document.getElementById('loginPass').addEventListener('keypress', e => { if(e.key==='Enter') intentarLogin(); });
  document.getElementById('loginUser').addEventListener('keypress', e => { if(e.key==='Enter') document.getElementById('loginPass').focus(); });
}

async function intentarLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const errDiv = document.getElementById('loginError');
  let found = USUARIOS.find(u => u.usuario===user && u.password===pass);

  // Cuentas de supervisores registradas en la nube
  if(!found && user && pass) {
    try {
      const snap = await getDocs(collection(db, COL_USERS));
      const cuentas = snap.docs.map(d => ({id:d.id, ...d.data()}));
      const c = cuentas.find(u => (u.usuario||'').toLowerCase()===user && u.password===pass && u.estado!=='inactivo');
      if(c) found = { usuario:c.usuario, nombre:c.supervisorNombre, rol:'supervisor' };
    } catch(e) { console.error('Error consultando cuentas:', e); }
  }

  if(!found) { errDiv.style.display='flex'; return; }
  errDiv.style.display='none';
  usuarioActual = found;
  resumenMostrado = false;
  avisoSupMostrado = false;
  dataRegsCargada = false;
  dataProgCargada = false;
  document.getElementById('loginPage').style.display='none';
  document.getElementById('appPage').style.display='block';
  pintarUsuarioUI(found);
  const btnClear=document.getElementById('btnClearAll');
  if(btnClear) btnClear.style.display=found.rol==='admin'?'inline-flex':'none';
  actualizarHeaderFecha();
  if(!uiInicializada) {
    initTabs();
    initForm();
    initFiltros();
    initBotones();
    initProgramacion();
    initNotificaciones();
    initPanelSupervisor();
    initUsuariosAdmin();
    uiInicializada = true;
  }
  aplicarRol();
  escucharFirebase();
  escucharSupervisores();
  escucharProgramaciones();
  escucharUsuarios();
}

function iniciales(nombre) {
  return (nombre||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '–';
}

const ROL_LABEL = { admin:'Administrador', usuario:'Equipo RRLL', supervisor:'Supervisor' };

function pintarUsuarioUI(u) {
  const ini = iniciales(u.nombre);
  setText('sfAvatar', ini);
  setText('chipAvatar', ini);
  setText('sfNombre', u.nombre);
  setText('sfRol', ROL_LABEL[u.rol]||u.rol);
  setText('userBadge', u.nombre.split(' ').slice(0,2).join(' '));
  aplicarLinkRRLL();
}

// Muestra los botones "Sistema RR.LL" solo si hay URL configurada
function aplicarLinkRRLL() {
  ['linkRRLL','linkRRLLLogin','linkRRLLTop'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    if(URL_SISTEMA_RRLL) { el.href = URL_SISTEMA_RRLL; el.style.display = 'inline-flex'; }
    else el.style.display = 'none';
  });
}

// Muestra u oculta la navegación según el rol del usuario
function aplicarRol() {
  const rol = usuarioActual?.rol || 'usuario';
  document.querySelectorAll('#sideNav [data-role]').forEach(el => {
    const r = el.dataset.role;
    const visible = rol==='supervisor' ? r==='supervisor'
      : (r==='staff' || (r==='admin' && rol==='admin'));
    el.style.display = visible ? '' : 'none';
  });
  const inicial = rol==='supervisor' ? 'mipanel' : 'dashboard';
  const btn = document.querySelector(`.tab-btn[data-tab="${inicial}"]`);
  if(btn) btn.click();
  if(rol==='supervisor') setText('supHeroNombre', 'Hola, '+usuarioActual.nombre.split(' ').slice(0,2).join(' '));
}

function cerrarSesion() {
  if(unsubscribe) { unsubscribe(); unsubscribe=null; }
  if(unsubSups) { unsubSups(); unsubSups=null; }
  if(unsubProg) { unsubProg(); unsubProg=null; }
  if(unsubUsers) { unsubUsers(); unsubUsers=null; }
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
    dataRegsCargada = true;
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
  renderPanelSupervisor();
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
  cumplido: { label:'Cumplido',        badge:'badge-verde',   color:'#157A46' },
  proceso:  { label:'En Proceso',      badge:'badge-azul',    color:'#1B55D6' },
  leve:     { label:'Retraso Leve',    badge:'badge-amarillo',color:'#B07B10' },
  critico:  { label:'Retraso Crítico', badge:'badge-rojo',    color:'#C62828' }
};

// ─── HEADER ───────────────────────────────────────────────────
function actualizarHeaderFecha() {
  const hoy=new Date();
  const temporada=detectarTemporada(hoy);
  const badge=document.getElementById('seasonBadge');
  badge.textContent=temporada==='alta'?'Temporada Alta':'Temporada Baja';
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
      const sec=document.getElementById('tab-'+btn.dataset.tab);
      if(sec) sec.classList.add('active');
      if(btn.dataset.title) setText('tbTitle', btn.dataset.title);
      setText('tbSub', btn.dataset.sub||'');
      window.scrollTo({top:0});
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
    <div class="preview-item"><div class="p-label">Temporada</div><div class="p-value">${temporada==='alta'?'Alta':'Baja'}</div></div>
    <div class="preview-item"><div class="p-label">Días hábiles</div><div class="p-value">Lun–${temporada==='alta'?'Sáb':'Vie'}</div></div>
    <div class="preview-item highlight"><div class="p-label">Fecha Límite</div><div class="p-value">${formatDateDisplay(fechaLimite)}</div></div>
    <div class="preview-item"><div class="p-label">Estado</div><div class="p-value" style="color:${restante>=0?'var(--verde)':'var(--rojo)'};">${restante>=0?'En plazo':'Vencido'}</div></div>
    <div class="preview-item"><div class="p-label">Total</div><div class="p-value">${v+m} (${v} V + ${m} M)</div></div>`;
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
    codigosCapacitados:parseCodigos(document.getElementById('fCodigos')?.value||''),
    registradoPor:usuarioActual?usuarioActual.nombre:'',
    creadoEn:new Date().toISOString()
  };
  try {
    const refDoc = await addDoc(collection(db,COL),reg);
    // Si viene de una programación, marcarla como ejecutada
    const progId = document.getElementById('fProgId').value;
    if(progId) {
      try { await updateDoc(doc(db, COL_PROG, progId), {estado:'ejecutada', registroId:refDoc.id, ejecutadaEn:new Date().toISOString()}); }
      catch(e2) { console.error('Error al marcar programación:', e2); }
    }
    showToast(progId ? '✅ Registro guardado y programación marcada como ejecutada.' : '✅ Registro guardado correctamente.', false);
    limpiarFormulario();
    document.querySelector('[data-tab="dashboard"]').click();
  } catch(e) {
    console.error(e);
    showToast('❌ Error al guardar. Verifica tu conexión.',true);
  }
}

// Convierte un texto libre en lista de códigos únicos
function parseCodigos(txt) {
  return [...new Set(String(txt||'').split(/[\s,;\n]+/).map(c=>c.trim()).filter(Boolean))];
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
  document.getElementById('fProgId').value='';
  document.getElementById('progVinculadaBanner').style.display='none';
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
        return `<div class="alert-card alert-amarillo"><span class="alert-icon"><svg class="ico"><use href="#i-clock"/></svg></span><div><strong>${esc(r.supervisor)}</strong> — ${esc(r.sector)}<br>Vence <strong>${formatDateDisplay(r.fechaLimite)}</strong> · Avance ${r.avance}% · ${esc(r.tema)}</div></div>`;
      const meta=ESTADO_META[r.estado];
      return `<div class="alert-card ${r.estado==='critico'?'alert-rojo':'alert-amarillo'}"><span class="alert-icon"><svg class="ico"><use href="#i-alert"/></svg></span><div><strong>${esc(r.supervisor)}</strong> — ${esc(r.sector)}<br>${meta.label} · <strong>${r.diasRetraso} día(s) hábil(es)</strong> · Límite: ${formatDateDisplay(r.fechaLimite)}</div></div>`;
    }).join('');
  }

  // Últimos registros
  const uDiv=document.getElementById('dashUltimos');
  if(!registros.length){uDiv.innerHTML='<p class="empty-msg">Sin registros aún.</p>';}
  else{
    uDiv.innerHTML=conEstado.slice(0,6).map(r=>{
      const meta=ESTADO_META[r.estado];
      return `<div class="alert-card alert-azul" style="cursor:pointer;" onclick="verDetalle('${r.id}')"><span class="alert-icon"><svg class="ico"><use href="#i-list"/></svg></span><div><strong>${esc(r.supervisor)}</strong> — ${esc(r.tema)}<br>${formatDateDisplay(r.fechaEjecucion)} · ${r.total} trabajadores · <span class="badge ${meta.badge}">${meta.label}</span></div></div>`;
    }).join('');
  }

  // Semáforo global + tendencias vs mes anterior
  renderSemaforo(pctCumpl);
  renderTendencias(conEstado);

  // Alertas de programación
  renderAlertasProg();

  // Avance por supervisor
  renderAvanceSupervisores(conEstado);

  // Charts
  renderChartsDashboard(cumplidos,proceso,conEstado);

  // Campana de notificaciones + resumen al iniciar sesión
  renderNotificaciones();
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
    const tipoIcon=r.tipoPersonal==='OBREROS'?'<span class="badge badge-verde">Obreros</span>':r.tipoPersonal==='EMPLEADOS'?'<span class="badge badge-azul">Empl.</span>':'–';
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
        <button class="btn btn-secondary btn-sm" onclick="verDetalle('${r.id}')" title="Ver detalle"><svg class="ico sm"><use href="#i-eye"/></svg></button>
        ${!r.fechaEnvio?`<button class="btn btn-primary btn-sm" onclick="abrirEnvio('${r.id}')" title="Registrar envío"><svg class="ico sm"><use href="#i-send"/></svg></button>`:''}
        ${esAdmin?`<button class="btn btn-danger btn-sm" onclick="eliminarRegistro('${r.id}')" title="Eliminar"><svg class="ico sm"><use href="#i-trash"/></svg></button>`:''}
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
  if(r.rutasTipo==='varias')rutasHtml='<div class="det-item full"><div class="det-label">Rutas</div><div class="det-value">Varias rutas (sin detalle)</div></div>';
  else if(r.rutasTexto)rutasHtml=`<div class="det-item full"><div class="det-label">Rutas</div><div class="det-value" style="font-weight:400;">${esc(r.rutasTexto)}</div></div>`;
  else if(r.rutas&&r.rutas.length)rutasHtml=`<div class="det-item full"><div class="det-label">Rutas (${r.rutas.length})</div><div class="det-value" style="font-weight:400;font-size:11.5px;">${r.rutas.map(x=>`<span class="badge badge-azul" style="margin:2px;">${esc(x.codigo)} ${esc(x.nombre)}</span>`).join('')}</div></div>`;
  let codigosHtml='';
  if(r.codigosCapacitados&&r.codigosCapacitados.length)codigosHtml=`<div class="det-item full"><div class="det-label">Códigos de capacitados (${r.codigosCapacitados.length})</div><div class="det-value" style="font-weight:400;font-size:11.5px;">${r.codigosCapacitados.map(c=>`<span class="badge badge-gris" style="margin:2px;">${esc(c)}</span>`).join('')}</div></div>`;
  let areasHtml='';
  if(r.areas&&r.areas.length)areasHtml=`<div class="det-item full"><div class="det-label">Áreas (${r.areas.length})</div><div class="det-value" style="font-weight:400;font-size:11.5px;">${r.areas.map(x=>`<span class="badge badge-azul" style="margin:2px;">${esc(x.nombre)}: ${x.cantidad}</span>`).join('')}</div></div>`;

  document.getElementById('detalleContent').innerHTML=`
    <div class="det-grid">
      <div class="det-item"><div class="det-label">Supervisor</div><div class="det-value">${esc(r.supervisor)}</div></div>
      <div class="det-item"><div class="det-label">Sector</div><div class="det-value">${esc(r.sector||'–')}</div></div>
      <div class="det-item"><div class="det-label">Tema</div><div class="det-value">${esc(r.tema)}</div></div>
      <div class="det-item"><div class="det-label">Tipo de Personal</div><div class="det-value">${r.tipoPersonal==='OBREROS'?'Obreros (Campo)':r.tipoPersonal==='EMPLEADOS'?'Empleados (Adm.)':'–'}</div></div>
      <div class="det-item"><div class="det-label">Varones / Mujeres</div><div class="det-value">${r.varones||0} varones · ${r.mujeres||0} mujeres</div></div>
      <div class="det-item"><div class="det-label">Total Capacitados</div><div class="det-value">${r.total||0} trabajadores</div></div>
      <div class="det-item"><div class="det-label">Fecha de Ejecución</div><div class="det-value">${formatDateDisplay(r.fechaEjecucion)}</div></div>
      <div class="det-item"><div class="det-label">Fecha Límite (3 días hábiles)</div><div class="det-value" style="color:var(--rojo);">${formatDateDisplay(r.fechaLimite)}</div></div>
      <div class="det-item"><div class="det-label">Fecha de Envío</div><div class="det-value">${r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'Pendiente'}</div></div>
      <div class="det-item"><div class="det-label">Temporada</div><div class="det-value">${r.temporada==='alta'?'Alta (Lun-Sáb)':'Baja (Lun-Vie)'}</div></div>
      <div class="det-item"><div class="det-label">Estado</div><div class="det-value"><span class="badge ${meta.badge}">${meta.label}</span>${est.diasRetraso?` · ${est.diasRetraso} día(s)`:''}</div></div>
      <div class="det-item"><div class="det-label">Registrado por</div><div class="det-value">${esc(r.registradoPor||'–')}</div></div>
      ${rutasHtml}${areasHtml}${codigosHtml}
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
      'Temporada':r.temporada,'Estado':ESTADO_META[est.estado].label,
      'Días Retraso':est.diasRetraso||0,'% Avance':est.estado==='proceso'?est.avance:est.estado==='cumplido'?100:0,
      'Rutas':r.rutasTipo==='varias'?'VARIAS':(r.rutasTexto||(r.rutas||[]).map(x=>x.codigo+' '+x.nombre).join('; ')),
      'Áreas':(r.areas||[]).map(x=>x.nombre+': '+x.cantidad).join('; '),
      'Códigos Capacitados':(r.codigosCapacitados||[]).join(', '),
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
    const posLabel=`${i+1}°`;
    const color=r.cumplimiento>=80?'#1a8040':r.cumplimiento>=50?'#c89010':'#cc0000';
    const fillClass=r.cumplimiento>=80?'pf-verde':r.cumplimiento>=50?'pf-amarillo':'pf-rojo';
    return `<div class="rank-item">
      <div class="rank-pos ${posClass}">${posLabel}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(r.nombre)}</div>
        <div class="rank-sub">${r.total} capacitaciones · ${r.trabajadores.toLocaleString()} trabajadores (${r.varones} V · ${r.mujeres} M) · Cumplidas ${r.cumplidos} · En proceso ${r.proceso} · Retrasos ${r.retrasos}</div>
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

// ════════════════════════════════════════════════
//  SUPERVISORES DINÁMICOS
// ════════════════════════════════════════════════
function escucharSupervisores() {
  const q = query(collection(db, COL_SUPS), orderBy('nombre'));
  unsubSups = onSnapshot(q, async snap => {
    if(snap.empty) {
      // Seed inicial una sola vez
      for(const s of SUPS_SEED) {
        await addDoc(collection(db, COL_SUPS), {...s, estado:'activo', creadoEn:new Date().toISOString()});
      }
      return; // el snapshot se volverá a disparar con los datos
    }
    supervisores = snap.docs.map(d => ({id:d.id, ...d.data()}));
    poblarSelectsSupervisores();
    renderListaSups();
  }, err => console.error('Sups error:', err));
}

function poblarSelectsSupervisores() {
  const activos = supervisores.filter(s => s.estado === 'activo');
  const opts = activos.map(s => `<option value="${esc(s.nombre)}|${esc(s.sector)}">${esc(s.nombre)} – ${esc(s.sector.replace(/^SECTOR\s*/i,''))}</option>`).join('');
  [['fSupervisor','— Seleccionar supervisor —'],['pSupervisor','— Seleccionar —'],['pFiltSup','Todos los supervisores'],['uSupervisor','— Seleccionar supervisor —']].forEach(([id,first]) => {
    const el = document.getElementById(id);
    if(!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${first}</option>` + ((id==='pFiltSup'||id==='uSupervisor')
      ? [...new Set(activos.map(s=>s.nombre))].map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')
      : opts);
    el.value = cur;
  });
}

window.abrirModalSups = function() {
  document.getElementById('nsNombre').value='';
  document.getElementById('nsSector').value='';
  renderListaSups();
  document.getElementById('modalSups').classList.add('open');
};
window.cerrarModalSups = function() {
  document.getElementById('modalSups').classList.remove('open');
};

window.guardarNuevoSup = async function() {
  const nombre = document.getElementById('nsNombre').value.trim().toUpperCase();
  let sector = document.getElementById('nsSector').value.trim().toUpperCase();
  if(!nombre || !sector) { showToast('Completa nombre y sector', true); return; }
  if(!sector.startsWith('SECTOR')) sector = 'SECTOR ' + sector;
  // Evitar duplicado exacto
  if(supervisores.some(s => s.nombre===nombre && s.sector===sector && s.estado==='activo')) {
    showToast('⚠️ Ese supervisor con ese sector ya existe', true); return;
  }
  try {
    await addDoc(collection(db, COL_SUPS), {nombre, sector, estado:'activo', creadoEn:new Date().toISOString()});
    document.getElementById('nsNombre').value='';
    document.getElementById('nsSector').value='';
    showToast(`✅ Supervisor "${nombre}" registrado`);
  } catch(e) { showToast('❌ Error al guardar', true); }
};

function renderListaSups() {
  const div = document.getElementById('listaSups');
  if(!div) return;
  if(!supervisores.length) { div.innerHTML='<p class="empty-msg">Sin supervisores.</p>'; return; }
  const esAdmin = usuarioActual?.rol === 'admin';
  div.innerHTML = supervisores.map(s => `
    <div class="sup-item ${s.estado!=='activo'?'inactivo':''}">
      <div>
        <div style="font-weight:700;font-size:12px;">${esc(s.nombre)}</div>
        <div style="font-size:10px;color:var(--gris-text);">${esc(s.sector)} ${s.estado!=='activo'?'· <span style="color:var(--rojo);font-weight:700;">INACTIVO</span>':''}</div>
      </div>
      <div style="display:flex;gap:5px;">
        ${s.estado==='activo'
          ? `<button class="btn btn-danger btn-sm" onclick="toggleSup('${s.id}','inactivo')" title="Desactivar"><svg class="ico sm"><use href="#i-lock"/></svg></button>`
          : `<button class="btn btn-success btn-sm" onclick="toggleSup('${s.id}','activo')" title="Reactivar"><svg class="ico sm"><use href="#i-check"/></svg></button>`}
        ${esAdmin?`<button class="btn btn-danger btn-sm" onclick="eliminarSup('${s.id}')" title="Eliminar"><svg class="ico sm"><use href="#i-trash"/></svg></button>`:''}
      </div>
    </div>`).join('');
}

window.toggleSup = async function(id, estado) {
  try { await updateDoc(doc(db, COL_SUPS, id), {estado}); showToast(estado==='activo'?'✅ Supervisor reactivado':'⛔ Supervisor desactivado'); }
  catch(e) { showToast('Error', true); }
};

window.eliminarSup = async function(id) {
  if(usuarioActual?.rol!=='admin') { showToast('Solo administradores', true); return; }
  if(!confirm('¿Eliminar este supervisor? El historial de capacitaciones se conserva.')) return;
  try { await deleteDoc(doc(db, COL_SUPS, id)); showToast('🗑 Supervisor eliminado'); }
  catch(e) { showToast('Error', true); }
};

// ════════════════════════════════════════════════
//  PROGRAMACIÓN DE CAPACITACIONES (PROYECCIÓN)
// ════════════════════════════════════════════════
function escucharProgramaciones() {
  const q = query(collection(db, COL_PROG), orderBy('fechaProgramada'));
  unsubProg = onSnapshot(q, snap => {
    programaciones = snap.docs.map(d => ({id:d.id, ...d.data()}));
    dataProgCargada = true;
    renderProgramaciones();
    renderDashboard(); // refresca alertas y KPIs
    renderPanelSupervisor();
  }, err => console.error('Prog error:', err));
}

function initProgramacion() {
  document.getElementById('pSupervisor').addEventListener('change', function() {
    document.getElementById('pSector').value = this.value ? this.value.split('|')[1]||'' : '';
  });
  // Fechas designadas en vivo (chips) — se generan del rango y se pueden ajustar una por una
  const regenerarFechas = () => {
    const ini = document.getElementById('pFecha').value;
    let fin = document.getElementById('pFechaFin').value;
    if(!ini) { progFechasSel=[]; renderPFechasChips(); return; }
    if(!fin) fin = ini;
    if(fin < ini) { document.getElementById('pDiasDesignados').value='⚠️ Fecha fin inválida'; return; }
    progFechasSel = fechasHabilesDelRango(ini, fin);
    renderPFechasChips();
  };
  document.getElementById('pFecha').addEventListener('change', regenerarFechas);
  document.getElementById('pFechaFin').addEventListener('change', regenerarFechas);
  document.getElementById('btnAddFecha').addEventListener('click', () => {
    const f = document.getElementById('pFechaExtra').value;
    if(!f) { showToast('Elige una fecha para agregar', true); return; }
    if(progFechasSel.includes(f)) { showToast('⚠️ Esa fecha ya está en la lista', true); return; }
    progFechasSel.push(f);
    progFechasSel.sort();
    document.getElementById('pFechaExtra').value='';
    renderPFechasChips();
  });
  // Modal editar: agregar fecha
  document.getElementById('btnAddFechaE').addEventListener('click', () => {
    const f = document.getElementById('eFechaExtra').value;
    if(!f) { showToast('Elige una fecha para agregar', true); return; }
    if(editFechasSel.includes(f)) { showToast('⚠️ Esa fecha ya está en la lista', true); return; }
    editFechasSel.push(f);
    document.getElementById('eFechaExtra').value='';
    renderEFechasList();
  });
  document.getElementById('btnProgGuardar').addEventListener('click', guardarProgramacion);
  document.getElementById('btnProgLimpiar').addEventListener('click', limpiarProg);
  document.getElementById('pFiltSup').addEventListener('change', renderProgramaciones);
  document.getElementById('pFiltEstado').addEventListener('change', renderProgramaciones);
  document.getElementById('btnProgExcel').addEventListener('click', exportProgExcel);
  document.getElementById('btnIncumplPdf').addEventListener('click', exportIncumplimientosPDF);
  document.getElementById('modalSups').addEventListener('click', function(e){if(e.target===this)cerrarModalSups();});
  // Modal reprogramación
  document.getElementById('modalReprog').addEventListener('click', function(e){if(e.target===this)cerrarReprog();});
  // Navegación calendario
  document.getElementById('btnCalPrev').addEventListener('click', () => { calMes--; if(calMes<0){calMes=11;calAnio--;} renderCalendario(); });
  document.getElementById('btnCalNext').addEventListener('click', () => { calMes++; if(calMes>11){calMes=0;calAnio++;} renderCalendario(); });
  document.getElementById('btnCalHoy').addEventListener('click', () => { const h=new Date(); calMes=h.getMonth(); calAnio=h.getFullYear(); renderCalendario(); });
}

async function guardarProgramacion() {
  const supVal = document.getElementById('pSupervisor').value;
  const tema = document.getElementById('pTema').value;
  const fecha = document.getElementById('pFecha').value;
  let fechaFin = document.getElementById('pFechaFin').value;
  const obs = document.getElementById('pObs').value.trim();
  if(!supVal || !tema || !fecha) { showToast('Completa supervisor, tema y fecha de inicio', true); return; }
  if(fechaFin && fechaFin < fecha) { showToast('⚠️ La fecha fin no puede ser anterior a la fecha inicio', true); return; }
  if(!fechaFin) fechaFin = fecha; // un solo día
  const [supervisor, sector] = supVal.split('|');
  // Usar las fechas seleccionadas en los chips (permiten fechas no consecutivas)
  const fechas = progFechasSel.length ? [...progFechasSel].sort() : fechasHabilesDelRango(fecha, fechaFin);
  if(!fechas.length) { showToast('⚠️ No hay fechas designadas válidas', true); return; }
  try {
    await addDoc(collection(db, COL_PROG), {
      supervisor, sector, tema,
      fechaProgramada: fechas[0],
      fechaFin: fechas[fechas.length-1],
      fechas,
      diasDesignados: fechas.length,
      observaciones: obs,
      estado: 'pendiente',
      registroId: null,
      creadoPor: usuarioActual?.nombre || '',
      creadoEn: new Date().toISOString()
    });
    limpiarProg();
    showToast(`📅 Programado: ${fechas.length} día(s) designado(s) para el sector`);
  } catch(e) { showToast('❌ Error al programar', true); }
}

// Días hábiles del rango INCLUSIVE (según temporada de cada día)
function diasHabilesRango(iniStr, finStr) {
  let count = 0;
  let d = new Date(iniStr + 'T12:00:00');
  const fin = new Date(finStr + 'T12:00:00');
  while(d <= fin) {
    if(esDiaHabil(d, detectarTemporada(d))) count++;
    d.setDate(d.getDate()+1);
  }
  return count || 1;
}

// Obtener rango normalizado de una programación (compatible con las antiguas de un solo día)
function rangoProg(p) {
  const fechas = fechasDeProg(p);
  return { ini: fechas[0], fin: fechas[fechas.length-1], dias: fechas.length, fechas };
}

// Array de fechas designadas de una programación (soporta fechas específicas no consecutivas)
function fechasDeProg(p) {
  if(p.fechas && p.fechas.length) return [...p.fechas].sort();
  const ini = p.fechaProgramada;
  const fin = p.fechaFin || p.fechaProgramada;
  return fechasHabilesDelRango(ini, fin);
}

// Fechas hábiles de un rango como array (según temporada de cada día)
function fechasHabilesDelRango(iniStr, finStr) {
  const out = [];
  let d = new Date(iniStr + 'T12:00:00');
  const fin = new Date(finStr + 'T12:00:00');
  while(d <= fin) {
    if(esDiaHabil(d, detectarTemporada(d))) out.push(formatDate(d));
    d.setDate(d.getDate()+1);
  }
  return out.length ? out : [iniStr];
}

function limpiarProg() {
  ['pSupervisor','pSector','pTema','pFecha','pFechaFin','pObs','pFechaExtra'].forEach(id => document.getElementById(id).value='');
  document.getElementById('pDiasDesignados').value='–';
  progFechasSel = [];
  renderPFechasChips();
}

// Estado calculado de una programación (soporta rango de días designados)
function estadoProg(p) {
  if(p.estado === 'ejecutada') return {key:'ejecutada', label:'Ejecutada', badge:'badge-verde', dias:0};
  const {ini, fin, dias} = rangoProg(p);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fIni = new Date(ini + 'T12:00:00'); fIni.setHours(0,0,0,0);
  const fFin = new Date(fin + 'T12:00:00'); fFin.setHours(0,0,0,0);

  // Hoy dentro del rango designado → EN CURSO (o "Para hoy" si es 1 solo día)
  if(hoy >= fIni && hoy <= fFin) {
    if(fIni.getTime() === fFin.getTime()) return {key:'hoy', label:'Para HOY', badge:'badge-amarillo', dias:0};
    const hoyStr = formatDate(hoy);
    const fechasP = fechasDeProg(p);
    const diaActual = Math.max(1, fechasP.filter(f => f <= hoyStr).length);
    return {key:'curso', label:`En Curso (día ${diaActual} de ${dias})`, badge:'badge-naranja', dias:0, diaActual, diasTot:dias};
  }
  if(fIni > hoy) {
    const diasCal = Math.round((fIni - hoy) / 86400000);
    return {key:'proxima', label:'Próxima', badge:'badge-azul', dias:diasCal};
  }
  // Vencida: días hábiles de atraso DESDE EL ÚLTIMO DÍA designado
  const dr = contarDiasHabiles(fFin, hoy);
  return {key:'vencida', label:'Vencida', badge:'badge-rojo', dias:dr};
}

function renderProgramaciones() {
  // KPIs
  const conEst = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  setText('pkTotal', programaciones.length);
  setText('pkProximas', conEst.filter(p => p._est.key==='proxima' && p._est.dias<=3).length);
  setText('pkHoy', conEst.filter(p => p._est.key==='hoy' || p._est.key==='curso').length);
  setText('pkVencidas', conEst.filter(p => p._est.key==='vencida').length);
  setText('pkEjecutadas', conEst.filter(p => p._est.key==='ejecutada').length);

  // Eficacia de programación: ejecutadas / (ejecutadas + vencidas)
  const nEjec = conEst.filter(p => p._est.key==='ejecutada').length;
  const nVenc = conEst.filter(p => p._est.key==='vencida').length;
  const eficacia = (nEjec+nVenc) ? Math.round((nEjec/(nEjec+nVenc))*100) : null;
  setText('pkEficacia', eficacia===null ? '–' : eficacia+'%');
  setText('kEficacia', eficacia===null ? '–' : eficacia+'%');

  // KPI reprogramadas
  setText('pkReprog', programaciones.filter(p => (p.vecesReprogramada||0)>0).length);

  // Indicador de motivos + historial
  renderMotivosReprog();

  // Calendario visual
  renderCalendario();

  // Tabla con filtros
  const fSup = document.getElementById('pFiltSup').value;
  const fEst = document.getElementById('pFiltEstado').value;
  let data = [...conEst];
  if(fSup) data = data.filter(p => p.supervisor === fSup);
  if(fEst) data = data.filter(p => p._est.key === fEst);
  // Orden: vencidas primero, luego hoy, próximas, ejecutadas al final
  const ordenKey = {vencida:0, curso:1, hoy:1, proxima:2, ejecutada:3};
  data.sort((a,b) => ordenKey[a._est.key]-ordenKey[b._est.key] || a.fechaProgramada.localeCompare(b.fechaProgramada));

  const tbody = document.getElementById('tbodyProg');
  if(!data.length) { tbody.innerHTML='<tr><td colspan="9" class="empty-msg">Sin programaciones que coincidan.</td></tr>'; return; }
  const esAdmin = usuarioActual?.rol === 'admin';
  tbody.innerHTML = data.map((p,i) => {
    const e = p._est;
    const diasTxt = e.key==='vencida' ? `<strong style="color:var(--rojo);">${e.dias} hábil(es) atraso</strong>`
      : e.key==='proxima' ? `${e.dias} día(s)` : '–';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(p.supervisor)}</strong></td>
      <td style="font-size:10.5px;">${esc(p.sector||'')}</td>
      <td style="font-size:10.5px;">${esc(p.tema)}</td>
      <td style="font-weight:700;">${(() => {
        const rg = rangoProg(p);
        const reprogBadge = (p.vecesReprogramada>0) ? `<br><span class="badge badge-naranja" style="font-size:8.5px;" title="${esc((p.reprogramaciones||[]).map(x=>x.motivo).join(', '))}">🔄 Reprogramada x${p.vecesReprogramada}</span>` : '';
        const consec = rg.fechas.length === fechasHabilesDelRango(rg.ini, rg.fin).length;
        const fechasTitle = rg.fechas.map(f=>formatDateDisplay(f)).join(' · ');
        return (rg.ini===rg.fin
          ? formatDateDisplay(rg.ini)
          : consec
            ? `${formatDateDisplay(rg.ini)} – ${formatDateDisplay(rg.fin)}<br><span style="font-size:9px;color:var(--azul-mid);">📆 ${rg.dias} día(s) designado(s)</span>`
            : `<span title="${fechasTitle}">${formatDateDisplay(rg.ini)} … ${formatDateDisplay(rg.fin)}</span><br><span style="font-size:9px;color:var(--naranja);" title="${fechasTitle}">📆 ${rg.dias} fechas específicas: ${fechasTitle}</span>`) + reprogBadge;
      })()}</td>
      <td><span class="badge ${e.badge}">${e.label}</span></td>
      <td>${diasTxt}</td>
      <td style="max-width:140px;font-size:10px;">${esc((p.observaciones||'').substring(0,40))}${(p.observaciones||'').length>40?'…':''}</td>
      <td style="white-space:nowrap;">
        ${p.estado!=='ejecutada' ? `<button class="btn btn-success btn-sm" onclick="ejecutarProg('${p.id}')" title="Registrar ejecución"><svg class="ico sm"><use href="#i-play"/></svg></button>` : ''}
        ${p.estado!=='ejecutada' ? `<button class="btn btn-secondary btn-sm" onclick="abrirReprog('${p.id}')" title="Editar / Reprogramar fechas"><svg class="ico sm"><use href="#i-edit"/></svg></button>` : ''}
        ${esAdmin || p.estado!=='ejecutada' ? `<button class="btn btn-danger btn-sm" onclick="eliminarProg('${p.id}')" title="Eliminar"><svg class="ico sm"><use href="#i-trash"/></svg></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// Ejecutar: lleva al formulario Registrar prellenado y vinculado
window.ejecutarProg = function(id) {
  const p = programaciones.find(x => x.id === id);
  if(!p) return;
  document.querySelector('[data-tab="registro"]').click();
  const sel = document.getElementById('fSupervisor');
  sel.value = p.supervisor + '|' + p.sector;
  document.getElementById('fSector').value = p.sector || '';
  document.getElementById('fTema').value = p.tema;
  document.getElementById('bloqueTipoPersonal').style.display = 'block';
  const rgEj = rangoProg(p);
  document.getElementById('fFechaEjecucion').value = rgEj.fin; // el plazo de actas corre desde el ÚLTIMO día designado
  document.getElementById('fProgId').value = id;
  document.getElementById('progVinculadaBanner').style.display = 'flex';
  verificarRetrasoForm();
  showToast('🔗 Completa los datos y guarda para marcar la programación como ejecutada');
  window.scrollTo({top:0, behavior:'smooth'});
};

window.desvincularProg = function() {
  document.getElementById('fProgId').value = '';
  document.getElementById('progVinculadaBanner').style.display = 'none';
};

window.eliminarProg = async function(id) {
  if(!confirm('¿Eliminar esta programación?')) return;
  try { await deleteDoc(doc(db, COL_PROG, id)); showToast('🗑 Programación eliminada'); }
  catch(e) { showToast('Error', true); }
};

function exportProgExcel() {
  if(!programaciones.length) { showToast('Sin datos', true); return; }
  const data = programaciones.map(p => {
    const e = estadoProg(p);
    return {
      'Supervisor': p.supervisor, 'Sector': p.sector||'', 'Tema': p.tema,
      'Fecha Inicio': p.fechaProgramada,
      'Fecha Fin': p.fechaFin||p.fechaProgramada,
      'Fechas Designadas': fechasDeProg(p).join(', '),
      'Días Designados': rangoProg(p).dias,
      'Estado': e.label,
      'Días': e.key==='vencida' ? e.dias+' hábiles de atraso' : e.key==='proxima' ? 'faltan '+e.dias : '',
      'Reprogramaciones': p.vecesReprogramada||0,
      'Motivos de Cambio': (p.reprogramaciones||[]).map(r=>r.motivo).join('; '),
      'Observaciones': p.observaciones||'', 'Programado Por': p.creadoPor||''
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Programaciones');
  XLSX.writeFile(wb, `ETI_Programaciones_${formatDate(new Date())}.xlsx`);
  showToast('📥 Excel exportado');
}

// ════════════════════════════════════════════════
//  INFORME DE INCUMPLIMIENTOS (PDF)
// ════════════════════════════════════════════════
function exportIncumplimientosPDF() {
  const progVencidas = programaciones.map(p => ({...p, _est: estadoProg(p)})).filter(p => p._est.key === 'vencida');
  const actasRetraso = registros.map(r => ({...r, ...calcularEstado(r)})).filter(r => r.estado==='leve' || r.estado==='critico');

  if(!progVencidas.length && !actasRetraso.length) {
    showToast('✅ No hay incumplimientos que reportar. ¡Todo al día!');
    return;
  }

  const {jsPDF} = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  let y = 18;

  pdf.setFontSize(15); pdf.setTextColor(153,0,0); pdf.setFont(undefined,'bold');
  pdf.text('INFORME DE INCUMPLIMIENTOS — CAPACITACIONES ETI', 15, y); y+=7;
  pdf.setFontSize(9.5); pdf.setTextColor(80,80,80); pdf.setFont(undefined,'normal');
  pdf.text(`Verfrut · Relaciones Laborales · Generado: ${formatDateDisplay(formatDate(new Date()))} · Sistema ETI v5.0`, 15, y); y+=4;
  pdf.setDrawColor(153,0,0); pdf.line(15, y, 195, y); y+=9;

  // Resumen
  pdf.setFontSize(11); pdf.setTextColor(0,26,94); pdf.setFont(undefined,'bold');
  pdf.text('RESUMEN', 15, y); y+=6.5;
  pdf.setFontSize(10); pdf.setTextColor(40,40,40); pdf.setFont(undefined,'normal');
  pdf.text(`• Capacitaciones programadas NO ejecutadas (vencidas): ${progVencidas.length}`, 18, y); y+=6;
  pdf.text(`• Actas con retraso en envío: ${actasRetraso.length}`, 18, y); y+=6;
  pdf.text(`• Total de casos de incumplimiento: ${progVencidas.length + actasRetraso.length}`, 18, y); y+=11;

  // Sección 1: Programaciones vencidas
  if(progVencidas.length) {
    pdf.setFontSize(12); pdf.setTextColor(153,0,0); pdf.setFont(undefined,'bold');
    pdf.text('1. CAPACITACIONES PROGRAMADAS NO EJECUTADAS', 15, y); y+=8;
    progVencidas.sort((a,b) => b._est.dias - a._est.dias);
    progVencidas.forEach((p, i) => {
      if(y > 262) { pdf.addPage(); y = 18; }
      pdf.setFontSize(10); pdf.setTextColor(20,20,20); pdf.setFont(undefined,'bold');
      pdf.text(`CASO ${i+1}: ${p.supervisor}`, 18, y); y+=5.5;
      pdf.setFontSize(9); pdf.setTextColor(70,70,70); pdf.setFont(undefined,'normal');
      pdf.text(`Sector: ${p.sector||'–'}  ·  Tema: ${p.tema}`, 21, y); y+=5;
      const rgPdf = rangoProg(p);
      const fTxt = rgPdf.ini===rgPdf.fin ? formatDateDisplay(rgPdf.ini) : `${formatDateDisplay(rgPdf.ini)} al ${formatDateDisplay(rgPdf.fin)} (${rgPdf.dias} días designados)`;
      pdf.text(`Fechas designadas: ${fTxt}  ·  Atraso: ${p._est.dias} día(s) hábil(es) desde el último día`, 21, y); y+=5;
      const sit = p.observaciones ? `Situación: ${p.observaciones}` : 'Situación: Sin observaciones registradas — requiere justificación del supervisor.';
      const sitLines = pdf.splitTextToSize(sit, 168);
      sitLines.forEach(l => { if(y>270){pdf.addPage();y=18;} pdf.text(l, 21, y); y+=4.5; });
      // Historial de reprogramaciones del caso
      if(p.reprogramaciones && p.reprogramaciones.length) {
        pdf.setTextColor(180,90,20);
        pdf.text(`Reprogramada ${p.reprogramaciones.length} vez/veces:`, 21, y); y+=4.5;
        p.reprogramaciones.forEach(rr => {
          if(y>270){pdf.addPage();y=18;}
          let cambioT;
          if(rr.cambios) cambioT = rr.cambios;
          else {
            const antT = rr.fechaAnteriorIni===rr.fechaAnteriorFin ? formatDateDisplay(rr.fechaAnteriorIni) : `${formatDateDisplay(rr.fechaAnteriorIni)} al ${formatDateDisplay(rr.fechaAnteriorFin)}`;
            const nueT = rr.nuevaIni===rr.nuevaFin ? formatDateDisplay(rr.nuevaIni) : `${formatDateDisplay(rr.nuevaIni)} al ${formatDateDisplay(rr.nuevaFin)}`;
            cambioT = `${antT} → ${nueT}`;
          }
          const linea = `  - ${cambioT} · Motivo: ${rr.motivo}${rr.detalle?` (${rr.detalle})`:''}`;
          const rrLines = pdf.splitTextToSize(linea, 165);
          rrLines.forEach(l => { if(y>270){pdf.addPage();y=18;} pdf.text(l, 23, y); y+=4.3; });
        });
        pdf.setTextColor(70,70,70);
      }
      y+=4;
    });
    y+=4;
  }

  // Sección 2: Actas con retraso
  if(actasRetraso.length) {
    if(y > 240) { pdf.addPage(); y = 18; }
    pdf.setFontSize(12); pdf.setTextColor(153,0,0); pdf.setFont(undefined,'bold');
    pdf.text('2. ACTAS CON RETRASO EN ENVÍO', 15, y); y+=8;
    actasRetraso.sort((a,b) => b.diasRetraso - a.diasRetraso);
    actasRetraso.forEach((r, i) => {
      if(y > 258) { pdf.addPage(); y = 18; }
      pdf.setFontSize(10); pdf.setTextColor(20,20,20); pdf.setFont(undefined,'bold');
      pdf.text(`CASO ${i+1}: ${r.supervisor} ${r.estado==='critico'?'[CRÍTICO]':'[LEVE]'}`, 18, y); y+=5.5;
      pdf.setFontSize(9); pdf.setTextColor(70,70,70); pdf.setFont(undefined,'normal');
      pdf.text(`Sector: ${r.sector||'–'}  ·  Tema: ${r.tema}  ·  ${r.total||0} trabajadores`, 21, y); y+=5;
      pdf.text(`Ejecutada: ${formatDateDisplay(r.fechaEjecucion)}  ·  Límite: ${formatDateDisplay(r.fechaLimite)}  ·  Envío: ${r.fechaEnvio?formatDateDisplay(r.fechaEnvio):'PENDIENTE'}`, 21, y); y+=5;
      pdf.text(`Retraso: ${r.diasRetraso} día(s) hábil(es)`, 21, y); y+=5;
      const mot = r.observaciones ? `Motivo: ${r.observaciones}` : 'Motivo: NO REGISTRADO — requiere justificación del supervisor.';
      const motLines = pdf.splitTextToSize(mot, 168);
      motLines.forEach(l => { if(y>270){pdf.addPage();y=18;} pdf.text(l, 21, y); y+=4.5; });
      y+=4;
    });
  }

  // Pie de firmas
  if(y > 240) { pdf.addPage(); y = 25; } else y+=12;
  pdf.setDrawColor(150,150,150);
  pdf.line(25, y+14, 85, y+14); pdf.line(125, y+14, 185, y+14);
  pdf.setFontSize(9); pdf.setTextColor(80,80,80);
  pdf.text('Coordinador de Relaciones Laborales', 30, y+19);
  pdf.text('Jefatura de Gestión Humana', 133, y+19);

  pdf.save(`Informe_Incumplimientos_ETI_${formatDate(new Date())}.pdf`);
  showToast('📄 Informe de incumplimientos descargado');
}

// ─── ALERTAS DE PROGRAMACIÓN (Dashboard) ──────────────────────
function renderAlertasProg() {
  const div = document.getElementById('dashAlertasProg');
  if(!div) return;
  const conEst = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  const vencidas = conEst.filter(p => p._est.key==='vencida').sort((a,b)=>b._est.dias-a._est.dias);
  const enCurso = conEst.filter(p => p._est.key==='curso');
  const paraHoy = conEst.filter(p => p._est.key==='hoy');
  const proximas = conEst.filter(p => p._est.key==='proxima' && p._est.dias<=3).sort((a,b)=>a._est.dias-b._est.dias);

  if(!vencidas.length && !enCurso.length && !paraHoy.length && !proximas.length) {
    div.innerHTML = '<p class="empty-msg">✅ Sin programaciones próximas ni vencidas.</p>';
    return;
  }
  let html = '';
  vencidas.slice(0,5).forEach(p => {
    const rg = rangoProg(p);
    const fechasTxt = rg.ini===rg.fin ? `el <strong>${formatDateDisplay(rg.ini)}</strong>` : `del <strong>${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)}</strong> (${rg.dias} días designados)`;
    html += `<div class="alert-card alert-rojo"><span class="alert-icon"><svg class="ico"><use href="#i-alert"/></svg></span><div><strong>INCUMPLIMIENTO — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} programada ${fechasTxt} — <strong>${p._est.dias} día(s) hábil(es) de atraso</strong></div></div>`;
  });
  enCurso.forEach(p => {
    const rg = rangoProg(p);
    html += `<div class="alert-card alert-amarillo"><span class="alert-icon"><svg class="ico"><use href="#i-activity"/></svg></span><div><strong>EN CURSO — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} — <strong>día ${p._est.diaActual} de ${p._est.diasTot} designados</strong> (${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)}). Al terminar el último día, registra la ejecución.</div></div>`;
  });
  paraHoy.forEach(p => {
    html += `<div class="alert-card alert-amarillo"><span class="alert-icon"><svg class="ico"><use href="#i-clock"/></svg></span><div><strong>HOY — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} programada para <strong>hoy</strong>. No olvides ejecutarla y registrarla.</div></div>`;
  });
  proximas.slice(0,4).forEach(p => {
    html += `<div class="alert-card alert-azul"><span class="alert-icon"><svg class="ico"><use href="#i-calendar"/></svg></span><div><strong>Próxima — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} el <strong>${formatDateDisplay(p.fechaProgramada)}</strong> (en ${p._est.dias} día(s))</div></div>`;
  });
  if(vencidas.length) {
    html += `<div style="margin-top:8px;"><button class="btn btn-pdf btn-sm" onclick="document.getElementById('btnIncumplPdf').click()"><svg class="ico sm"><use href="#i-file"/></svg> Generar Informe de Incumplimientos</button></div>`;
  }
  div.innerHTML = html;
}

// ════════════════════════════════════════════════
//  SEMÁFORO GLOBAL DE SALUD
// ════════════════════════════════════════════════
function renderSemaforo(pctCumplActas) {
  const banner = document.getElementById('semaforoBanner');
  if(!banner) return;
  const conEst = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  const nEjec = conEst.filter(p => p._est.key==='ejecutada').length;
  const nVenc = conEst.filter(p => p._est.key==='vencida').length;
  const eficaciaProg = (nEjec+nVenc) ? Math.round((nEjec/(nEjec+nVenc))*100) : null;

  // Score combinado: promedio de cumplimiento de actas y eficacia de programación
  let score, partes=[];
  const finActas = registros.map(r=>calcularEstado(r)).filter(e=>e.estado!=='proceso').length;
  if(finActas>0) partes.push(pctCumplActas);
  if(eficaciaProg!==null) partes.push(eficaciaProg);
  score = partes.length ? Math.round(partes.reduce((a,b)=>a+b,0)/partes.length) : null;

  const luz = document.getElementById('semaforoLuz');
  const detalle = document.getElementById('semaforoDetalle');
  const scoreEl = document.getElementById('semaforoScore');

  if(score===null) {
    banner.className='semaforo-banner';
    luz.textContent='⚪';
    scoreEl.textContent='–';
    detalle.textContent='Aún no hay suficientes datos. Registra capacitaciones y programaciones para calcular la salud del sistema.';
    return;
  }
  scoreEl.textContent=score+'%';
  const dActas = finActas>0 ? `Actas a tiempo: ${pctCumplActas}%` : 'Actas: sin datos';
  const dProg = eficaciaProg!==null ? `Eficacia de programación: ${eficaciaProg}%` : 'Programación: sin datos';
  const dVenc = nVenc>0 ? ` · ⚠️ ${nVenc} programación(es) vencida(s) sin ejecutar` : '';
  detalle.textContent = `${dActas} · ${dProg}${dVenc}`;
  if(score>=80) { banner.className='semaforo-banner'; luz.textContent='🟢'; }
  else if(score>=50) { banner.className='semaforo-banner amarillo'; luz.textContent='🟡'; }
  else { banner.className='semaforo-banner rojo'; luz.textContent='🔴'; }
}

// ════════════════════════════════════════════════
//  TENDENCIAS VS MES ANTERIOR (▲▼)
// ════════════════════════════════════════════════
function renderTendencias(conEstado) {
  const hoy = new Date();
  const mesActual = hoy.getFullYear()*100 + hoy.getMonth();
  const prev = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1);
  const mesPrev = prev.getFullYear()*100 + prev.getMonth();

  const delMes = (m) => conEstado.filter(r => {
    const d = new Date(r.fechaEjecucion+'T12:00:00');
    return d.getFullYear()*100+d.getMonth() === m;
  });
  const act = delMes(mesActual), ant = delMes(mesPrev);

  const setTrend = (id, vAct, vAnt, invertir=false) => {
    const el = document.getElementById(id);
    if(!el) return;
    if(vAnt===0 && vAct===0) { el.textContent=''; el.className='kpi-trend'; return; }
    const diff = vAct - vAnt;
    if(diff===0) { el.textContent='= igual que mes ant.'; el.className='kpi-trend neutral'; return; }
    const pct = vAnt>0 ? Math.abs(Math.round((diff/vAnt)*100)) : 100;
    const sube = diff>0;
    const positivo = invertir ? !sube : sube; // para retrasos, subir es malo
    el.textContent = `${sube?'▲':'▼'} ${pct}% vs mes ant.`;
    el.className = 'kpi-trend ' + (positivo?'up':'down');
  };

  setTrend('tTotal', act.length, ant.length);
  setTrend('tTrabajadores', act.reduce((a,r)=>a+(r.total||0),0), ant.reduce((a,r)=>a+(r.total||0),0));
  setTrend('tCumplidos', act.filter(r=>r.estado==='cumplido').length, ant.filter(r=>r.estado==='cumplido').length);
  setTrend('tRetrasos', act.filter(r=>r.estado==='leve'||r.estado==='critico').length, ant.filter(r=>r.estado==='leve'||r.estado==='critico').length, true);
}

// ════════════════════════════════════════════════
//  CALENDARIO VISUAL MENSUAL
// ════════════════════════════════════════════════
let calMes = new Date().getMonth();
let calAnio = new Date().getFullYear();

function renderCalendario() {
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  setText('calTitulo', `${MESES[calMes]} ${calAnio}`);

  const hoyStr = formatDate(new Date());
  const primerDia = new Date(calAnio, calMes, 1);
  const ultimoDia = new Date(calAnio, calMes+1, 0);
  // Lunes=0 ... Domingo=6
  let inicio = primerDia.getDay()-1; if(inicio<0) inicio=6;

  // Programaciones por fecha (un chip por cada fecha designada, aunque no sean consecutivas)
  const porFecha = {};
  programaciones.forEach(p => {
    const est = estadoProg(p);
    const fechasP = fechasDeProg(p);
    fechasP.forEach((fStr, idx) => {
      if(!porFecha[fStr]) porFecha[fStr]=[];
      porFecha[fStr].push({...p, _est: est, _nDia: idx+1, _diasTot: fechasP.length});
    });
  });

  let html = '';
  // Días del mes anterior (relleno)
  const prevUltimo = new Date(calAnio, calMes, 0).getDate();
  for(let i=inicio-1; i>=0; i--) {
    html += `<div class="cal-dia otro-mes"><div class="cal-dia-num">${prevUltimo-i}</div></div>`;
  }
  // Días del mes
  for(let d=1; d<=ultimoDia.getDate(); d++) {
    const fecha = new Date(calAnio, calMes, d);
    const fStr = formatDate(fecha);
    const temporada = detectarTemporada(fecha);
    const esHoy = fStr===hoyStr;
    const habil = esDiaHabil(fecha, temporada);
    const progs = porFecha[fStr]||[];
    let chips = '';
    progs.slice(0,3).forEach(p => {
      const cls = p._est.key==='ejecutada'?'c-ejecutada':p._est.key==='vencida'?'c-vencida':p._est.key==='hoy'?'c-hoy':'c-proxima';
    const nombreCorto = p.supervisor.split(' ')[0]+' '+(p.supervisor.split(' ')[1]||'');
      const temaCorto = p.tema==='CAPACITACIONES ETI'?'ETI':p.tema==='EVALUACIONES DE CHECKLIST'?'CHECKLIST':'REFORZ.';
      const diaTag = p._diasTot>1 ? ` (${p._nDia}/${p._diasTot})` : '';
      chips += `<span class="cal-chip ${cls}" title="${esc(p.supervisor)} · ${esc(p.tema)} · ${esc(p.sector||'')}${p._diasTot>1?` · Día ${p._nDia} de ${p._diasTot}`:''}" onclick="verProgDia('${fStr}')">${temaCorto}: ${esc(nombreCorto)}${diaTag}</span>`;
    });
    if(progs.length>3) chips += `<span class="cal-mas" onclick="verProgDia('${fStr}')">+${progs.length-3} más...</span>`;
    html += `<div class="cal-dia ${esHoy?'hoy':''} ${!habil?'no-habil':''}"><div class="cal-dia-num">${d}${esHoy?' · HOY':''}</div>${chips}</div>`;
  }
  // Relleno siguiente mes
  const totalCeldas = inicio + ultimoDia.getDate();
  const faltan = (7 - (totalCeldas % 7)) % 7;
  for(let d=1; d<=faltan; d++) {
    html += `<div class="cal-dia otro-mes"><div class="cal-dia-num">${d}</div></div>`;
  }
  grid.innerHTML = html;
}

// Ver programaciones de un día (filtra la tabla y hace scroll)
window.verProgDia = function(fechaStr) {
  const progs = programaciones.filter(p => fechasDeProg(p).includes(fechaStr));
  if(!progs.length) return;
  const detalle = progs.map(p => {
    const e = estadoProg(p);
    const rg = rangoProg(p);
    const consecutivas = rg.fechas.length === fechasHabilesDelRango(rg.ini, rg.fin).length;
    const rango = rg.ini===rg.fin ? formatDateDisplay(rg.ini)
      : consecutivas ? `${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)} (${rg.dias} días designados)`
      : rg.fechas.map(f=>formatDateDisplay(f)).join(', ') + ` (${rg.dias} fechas designadas)`;
    return `${e.label} — ${p.supervisor} · ${p.tema}\n   Sector: ${p.sector||''} · Fechas: ${rango}`;
  }).join('\n\n');
  alert(`📅 Programaciones del ${formatDateDisplay(fechaStr)}:\n\n${detalle}`);
};

// ════════════════════════════════════════════════
//  REPROGRAMACIÓN (EDITAR FECHAS CON MOTIVO)
// ════════════════════════════════════════════════
let chartMotivos = null;

let editFechasSel = [];
let editFechasOrig = [];

window.abrirReprog = function(id) {
  const p = programaciones.find(x => x.id === id);
  if(!p) return;
  const rg = rangoProg(p);
  document.getElementById('eProgId').value = id;
  const fechasTxt = rg.fechas.map(f=>formatDateDisplay(f)).join(' · ');
  document.getElementById('eProgInfo').innerHTML = `<strong>${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} — Fechas actuales: <strong>${fechasTxt}</strong> (${rg.dias} día(s))${p.vecesReprogramada?`<br><span style="color:var(--naranja);font-weight:700;">🔄 Ya fue reprogramada ${p.vecesReprogramada} vez/veces</span>`:''}`;
  editFechasOrig = [...rg.fechas];
  editFechasSel = [...rg.fechas];
  document.getElementById('eMotivo').value = '';
  document.getElementById('eDetalle').value = '';
  document.getElementById('eFechaExtra').value = '';
  renderEFechasList();
  document.getElementById('modalReprog').classList.add('open');
};
window.cerrarReprog = function() { document.getElementById('modalReprog').classList.remove('open'); };

function renderEFechasList() {
  const div = document.getElementById('eFechasList');
  if(!editFechasSel.length) {
    div.innerHTML = '<p class="empty-msg" style="padding:12px;">Sin fechas — agrega al menos una.</p>';
  } else {
    div.innerHTML = editFechasSel.map((f, i) => {
      const orig = editFechasOrig[i];
      const cambiada = orig !== undefined && orig !== f;
      return `<div class="efecha-row">
        <div class="efecha-num">${i+1}</div>
        <input type="date" value="${f}" class="${cambiada?'cambiada':''}" onchange="cambiarFechaE(${i}, this.value)" />
        ${cambiada ? `<span class="efecha-orig">antes: ${formatDateDisplay(orig)} 🔄</span>` : (orig!==undefined ? '<span class="efecha-orig">sin cambio</span>' : '<span class="efecha-orig" style="color:var(--verde);">nueva ➕</span>')}
        <button type="button" class="efecha-x" onclick="quitarFechaE(${i})" title="Quitar esta fecha">✕</button>
      </div>`;
    }).join('');
  }
  document.getElementById('eDias').value = editFechasSel.length ? `${editFechasSel.length} día(s) designado(s)` : '–';
}

window.cambiarFechaE = function(i, val) {
  if(!val) return;
  if(editFechasSel.some((f, j) => j!==i && f===val)) { showToast('⚠️ Esa fecha ya está en la lista', true); renderEFechasList(); return; }
  editFechasSel[i] = val;
  renderEFechasList();
};
window.quitarFechaE = function(i) {
  editFechasSel.splice(i, 1);
  editFechasOrig.splice(i, 1);
  renderEFechasList();
};

window.guardarReprog = async function() {
  const id = document.getElementById('eProgId').value;
  const p = programaciones.find(x => x.id === id);
  if(!p) return;
  const motivo = document.getElementById('eMotivo').value;
  const detalle = document.getElementById('eDetalle').value.trim();

  if(!editFechasSel.length) { showToast('⚠️ Debe quedar al menos una fecha designada', true); return; }
  const nuevas = [...editFechasSel].sort();
  const anteriores = [...fechasDeProg(p)].sort();
  const sinCambio = JSON.stringify(nuevas) === JSON.stringify(anteriores);
  if(sinCambio) { showToast('⚠️ Las fechas son iguales a las actuales. No hay cambio.', true); return; }
  if(!motivo) { showToast('⚠️ El MOTIVO del cambio de fecha es obligatorio', true); document.getElementById('eMotivo').focus(); return; }

  // Detalle de cambios específicos: pares cambiados, quitadas y agregadas
  const cambios = [];
  editFechasOrig.forEach((orig, i) => {
    if(orig !== undefined && editFechasSel[i] !== undefined && orig !== editFechasSel[i])
      cambios.push(`${formatDateDisplay(orig)} → ${formatDateDisplay(editFechasSel[i])}`);
  });
  anteriores.filter(f => !nuevas.includes(f) && !cambios.some(c => c.startsWith(formatDateDisplay(f)))).forEach(f => cambios.push(`${formatDateDisplay(f)} eliminada`));
  nuevas.filter(f => !anteriores.includes(f) && !cambios.some(c => c.endsWith(formatDateDisplay(f)))).forEach(f => cambios.push(`${formatDateDisplay(f)} agregada`));

  const entrada = {
    fechaAnteriorIni: anteriores[0],
    fechaAnteriorFin: anteriores[anteriores.length-1],
    fechasAnterior: anteriores,
    fechasNueva: nuevas,
    nuevaIni: nuevas[0],
    nuevaFin: nuevas[nuevas.length-1],
    cambios: cambios.join(' · '),
    motivo, detalle,
    registradoPor: usuarioActual?.nombre || '',
    fecha: new Date().toISOString()
  };
  try {
    await updateDoc(doc(db, COL_PROG, id), {
      fechaProgramada: nuevas[0],
      fechaFin: nuevas[nuevas.length-1],
      fechas: nuevas,
      diasDesignados: nuevas.length,
      reprogramaciones: [...(p.reprogramaciones||[]), entrada],
      vecesReprogramada: (p.vecesReprogramada||0) + 1
    });
    cerrarReprog();
    showToast(`🔄 Reprogramada: ${cambios.join(' · ')}`);
  } catch(e) { showToast('❌ Error al reprogramar', true); }
};

// ─── INDICADOR DE MOTIVOS + HISTORIAL ─────────────────────────
function renderMotivosReprog() {
  const todas = [];
  programaciones.forEach(p => (p.reprogramaciones||[]).forEach(r => todas.push({...r, supervisor:p.supervisor, sector:p.sector, tema:p.tema})));

  // Chart de motivos
  const conteo = {};
  todas.forEach(r => { conteo[r.motivo] = (conteo[r.motivo]||0)+1; });
  const labels = Object.keys(conteo).sort((a,b)=>conteo[b]-conteo[a]);
  const datos = labels.map(l => conteo[l]);
  const colores = ['#0050c8','#cc0000','#c89010','#e07a2a','#1a8040','#6a4c93','#9aaabb'];

  const canvas = document.getElementById('chartMotivos');
  if(canvas) {
    if(!todas.length) {
      if(chartMotivos) { chartMotivos.destroy(); chartMotivos=null; }
      canvas.style.display='none';
    } else {
      canvas.style.display='block';
      if(chartMotivos) { chartMotivos.data.labels=labels; chartMotivos.data.datasets[0].data=datos; chartMotivos.update('none'); }
      else chartMotivos = new Chart(canvas, {type:'doughnut',
        data:{labels, datasets:[{data:datos, backgroundColor:colores, borderWidth:0}]},
        options:{responsive:true, maintainAspectRatio:false, animation:{duration:300}, plugins:{legend:{position:'bottom', labels:{font:{family:'Tahoma',size:9.5}}}}, cutout:'55%'}});
    }
  }

  // Lista resumen
  const lDiv = document.getElementById('listaMotivos');
  if(lDiv) {
    lDiv.innerHTML = !todas.length
      ? '<p class="empty-msg">Sin reprogramaciones registradas aún.</p>'
      : labels.map((l,i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--azul-bg);border-radius:7px;margin-bottom:5px;font-size:11.5px;">
          <span style="font-weight:700;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${colores[i%colores.length]};margin-right:7px;"></span>${esc(l)}</span>
          <span class="badge badge-azul">${conteo[l]} cambio(s)</span>
        </div>`).join('');
  }

  // Historial
  const hDiv = document.getElementById('histReprog');
  if(hDiv) {
    if(!todas.length) { hDiv.innerHTML='<p class="empty-msg">Sin reprogramaciones registradas.</p>'; return; }
    todas.sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));
    hDiv.innerHTML = todas.slice(0,15).map(r => {
      let cambioTxt;
      if(r.cambios) {
        cambioTxt = `<strong>${esc(r.cambios)}</strong>`;
      } else {
        const antTxt = r.fechaAnteriorIni===r.fechaAnteriorFin ? formatDateDisplay(r.fechaAnteriorIni) : `${formatDateDisplay(r.fechaAnteriorIni)}–${formatDateDisplay(r.fechaAnteriorFin)}`;
        const nueTxt = r.nuevaIni===r.nuevaFin ? formatDateDisplay(r.nuevaIni) : `${formatDateDisplay(r.nuevaIni)}–${formatDateDisplay(r.nuevaFin)}`;
        cambioTxt = `<span style="color:var(--gris-text);">${antTxt}</span> ➜ <strong>${nueTxt}</strong>`;
      }
      return `<div class="alert-card alert-naranja">
        <span class="alert-icon"><svg class="ico"><use href="#i-refresh"/></svg></span>
        <div style="font-size:11.5px;">
          <strong>${esc(r.supervisor)}</strong> · ${esc(r.sector||'')} · ${esc(r.tema)}<br>
          ${cambioTxt}<br>
          <span class="badge badge-naranja" style="margin-top:3px;">${esc(r.motivo)}</span>${r.detalle?` <span style="font-size:10px;color:var(--gris-text);">— ${esc(r.detalle)}</span>`:''}
        </div>
      </div>`;
    }).join('');
  }
}

// ─── CHIPS DE FECHAS EN FORMULARIO DE PROGRAMACIÓN ────────────
let progFechasSel = [];

function renderPFechasChips() {
  const div = document.getElementById('pFechasChips');
  if(!div) return;
  if(!progFechasSel.length) {
    div.innerHTML = '<span class="empty-chip">Elige fecha inicio (y fin) para generar las fechas, o agrégalas una por una aquí abajo</span>';
  } else {
    div.innerHTML = progFechasSel.map((f, i) =>
      `<span class="fecha-chip">📅 ${formatDateDisplay(f)}<span class="chip-x" onclick="quitarFechaP(${i})" title="Quitar">✕</span></span>`
    ).join('');
  }
  document.getElementById('pDiasDesignados').value = progFechasSel.length
    ? `${progFechasSel.length} día(s) designado(s) para capacitar` : '–';
}

window.quitarFechaP = function(i) {
  progFechasSel.splice(i, 1);
  renderPFechasChips();
};

// ════════════════════════════════════════════════
//  CAMPANA DE NOTIFICACIONES Y RESUMEN DE VENCIMIENTOS
// ════════════════════════════════════════════════
function initNotificaciones() {
  const btn = document.getElementById('btnNotif');
  const panel = document.getElementById('notifPanel');
  if(!btn || !panel) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if(panel.classList.contains('open') && !panel.contains(e.target) && e.target!==btn) panel.classList.remove('open');
  });
}

// Calcula todas las alertas de vencimiento vigentes
function calcularAlertas() {
  const esSup = usuarioActual?.rol === 'supervisor';
  const miNombre = usuarioActual?.nombre;

  let progs = programaciones.map(p => ({...p, _est: estadoProg(p)}));
  let regs = registros.map(r => ({...r, ...calcularEstado(r)}));
  if(esSup) {
    progs = progs.filter(p => p.supervisor === miNombre);
    regs = regs.filter(r => r.supervisor === miNombre);
  }

  const alertas = [];
  // Programaciones vencidas (lo más urgente)
  progs.filter(p => p._est.key==='vencida').sort((a,b)=>b._est.dias-a._est.dias).forEach(p => {
    alertas.push({tipo:'rojo', icono:'i-alert', titulo:`Programación VENCIDA — ${p.supervisor}`,
      detalle:`${p.tema} · ${p.sector||''}`, meta:`${p._est.dias} día(s) hábil(es) de atraso · fechas: ${fechasDeProg(p).map(f=>formatDateDisplay(f)).join(', ')}`, urgente:true});
  });
  // Para hoy / en curso
  progs.filter(p => p._est.key==='hoy' || p._est.key==='curso').forEach(p => {
    alertas.push({tipo:'ambar', icono:'i-clock', titulo:`${p._est.key==='hoy'?'Programada para HOY':'En curso'} — ${p.supervisor}`,
      detalle:`${p.tema} · ${p.sector||''}`, meta: p._est.key==='curso'?`Día ${p._est.diaActual} de ${p._est.diasTot} designados`:'Ejecutar y registrar hoy', urgente:false});
  });
  // Próximas a vencer (3, 2, 1 días)
  progs.filter(p => p._est.key==='proxima' && p._est.dias<=3).sort((a,b)=>a._est.dias-b._est.dias).forEach(p => {
    alertas.push({tipo:'azul', icono:'i-calendar', titulo:`${p._est.dias===1?'Vence MAÑANA':'En '+p._est.dias+' días'} — ${p.supervisor}`,
      detalle:`${p.tema} · ${p.sector||''}`, meta:`Programada para el ${formatDateDisplay(p.fechaProgramada)}`, urgente:false});
  });
  // Actas con retraso
  regs.filter(r => r.estado==='leve'||r.estado==='critico').sort((a,b)=>b.diasRetraso-a.diasRetraso).forEach(r => {
    alertas.push({tipo:'rojo', icono:'i-send', titulo:`Actas con retraso — ${r.supervisor}`,
      detalle:`${r.tema} · ejecutada el ${formatDateDisplay(r.fechaEjecucion)}`, meta:`${r.diasRetraso} día(s) hábil(es) de retraso · límite era ${formatDateDisplay(r.fechaLimite)}`, urgente:true});
  });
  // Actas por vencer (avance >= 66%)
  regs.filter(r => r.estado==='proceso' && r.avance>=66).forEach(r => {
    alertas.push({tipo:'naranja', icono:'i-clock', titulo:`Actas por vencer — ${r.supervisor}`,
      detalle:`${r.tema} · ${r.sector||''}`, meta:`Enviar actas antes del ${formatDateDisplay(r.fechaLimite)}`, urgente:false});
  });
  return alertas;
}

function renderNotificaciones() {
  const dot = document.getElementById('notifDot');
  const bell = document.getElementById('btnNotif');
  const body = document.getElementById('notifBody');
  if(!dot || !bell || !body) return;

  const alertas = calcularAlertas();
  const urgentes = alertas.filter(a => a.urgente).length;

  // Contador en campana y en menú lateral
  dot.style.display = alertas.length ? 'flex' : 'none';
  dot.textContent = alertas.length > 99 ? '99+' : alertas.length;
  bell.classList.toggle('has-alerts', alertas.length>0);
  bell.classList.toggle('urgente', urgentes>0);
  setText('notifResumen', alertas.length ? `${alertas.length} alerta(s) · ${urgentes} urgente(s)` : 'Todo al día');

  const ncProg = document.getElementById('navCountProg');
  if(ncProg) {
    const nVenc = programaciones.filter(p => estadoProg(p).key==='vencida').length;
    ncProg.style.display = nVenc ? 'inline-flex' : 'none';
    ncProg.textContent = nVenc;
  }

  if(!alertas.length) {
    body.innerHTML = `<div class="notif-empty"><svg class="ico"><use href="#i-check-circle"/></svg><br>Sin alertas de vencimiento.<br>Todo al día.</div>`;
  } else {
    body.innerHTML = alertas.slice(0,20).map(a => `
      <div class="notif-item n-${a.tipo}">
        <div class="n-icon"><svg class="ico sm"><use href="#${a.icono}"/></svg></div>
        <div><strong>${esc(a.titulo)}</strong><br>${esc(a.detalle)}<div class="n-meta">${esc(a.meta)}</div></div>
      </div>`).join('');
  }

  mostrarResumenSiCorresponde(alertas);
}

// Modal de resumen al iniciar sesión (una vez por sesión)
// Para supervisores NO se muestra: ellos reciben el aviso automático
// con su formulario de registro abierto (ver avisoAutomaticoSupervisor)
function mostrarResumenSiCorresponde(alertas) {
  if(resumenMostrado || !usuarioActual) return;
  if(usuarioActual.rol === 'supervisor') { resumenMostrado = true; return; }
  if(!dataRegsCargada || !dataProgCargada) return;
  resumenMostrado = true;
  if(!alertas.length) return;

  const nVencidas = alertas.filter(a => a.icono==='i-alert').length;
  const nHoy = alertas.filter(a => a.tipo==='ambar').length;
  const nProx = alertas.filter(a => a.tipo==='azul').length;
  const nActas = alertas.filter(a => a.icono==='i-send' || a.tipo==='naranja').length;

  document.getElementById('resumenContent').innerHTML = `
    <div class="resumen-alertas-head">
      <div class="resumen-alertas-icon"><svg class="ico lg"><use href="#i-bell"/></svg></div>
      <div style="font-size:13px;line-height:1.6;">Hola <strong>${esc(usuarioActual.nombre.split(' ')[0])}</strong>, tienes <strong>${alertas.length} alerta(s)</strong> de vencimiento que requieren tu atención.</div>
    </div>
    <div class="resumen-stats">
      ${nVencidas?`<div class="resumen-stat rs-rojo"><div class="rs-num">${nVencidas}</div><div class="rs-label">Vencidas</div></div>`:''}
      ${nHoy?`<div class="resumen-stat rs-ambar"><div class="rs-num">${nHoy}</div><div class="rs-label">Hoy / En curso</div></div>`:''}
      ${nProx?`<div class="resumen-stat rs-azul"><div class="rs-num">${nProx}</div><div class="rs-label">Próximas ≤3 días</div></div>`:''}
      ${nActas?`<div class="resumen-stat rs-naranja rs-ambar"><div class="rs-num">${nActas}</div><div class="rs-label">Actas</div></div>`:''}
    </div>
    <div style="max-height:220px;overflow-y:auto;">
      ${alertas.slice(0,6).map(a=>`
        <div class="notif-item n-${a.tipo}" style="border:1px solid var(--linea);">
          <div class="n-icon"><svg class="ico sm"><use href="#${a.icono}"/></svg></div>
          <div><strong>${esc(a.titulo)}</strong><div class="n-meta">${esc(a.meta)}</div></div>
        </div>`).join('')}
      ${alertas.length>6?`<p style="font-size:11px;color:var(--texto-3);text-align:center;margin-top:6px;">y ${alertas.length-6} alerta(s) más — revisa la campana de notificaciones</p>`:''}
    </div>`;
  document.getElementById('modalResumen').classList.add('open');
}
window.cerrarResumen = function() { document.getElementById('modalResumen').classList.remove('open'); };

// ════════════════════════════════════════════════
//  MI PANEL — MÓDULO DE REGISTRO PARA SUPERVISORES
// ════════════════════════════════════════════════
function initPanelSupervisor() {
  const upd = () => {
    const v=parseInt(document.getElementById('sVarones').value)||0;
    const m=parseInt(document.getElementById('sMujeres').value)||0;
    document.getElementById('sTotalCalc').value=(v+m)+' trabajadores';
  };
  ['sVarones','sMujeres'].forEach(id => document.getElementById(id)?.addEventListener('input', upd));
  document.getElementById('sCodigos')?.addEventListener('input', function() {
    setText('sCodigosCount', parseCodigos(this.value).length + ' códigos ingresados');
  });
  document.getElementById('btnSupGuardar')?.addEventListener('click', guardarRegistroSupervisor);
  document.getElementById('btnSupCancelar')?.addEventListener('click', cerrarFormSup);
}

function cerrarFormSup() {
  document.getElementById('supFormPanel').style.display='none';
  ['sProgId','sFechaEjec','sVarones','sMujeres','sRutas','sCodigos','sObs'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  document.getElementById('sTotalCalc').value='0 trabajadores';
  setText('sCodigosCount','0 códigos ingresados');
}

function renderPanelSupervisor() {
  if(!usuarioActual || usuarioActual.rol!=='supervisor') return;
  const nombre = usuarioActual.nombre;
  const mias = programaciones.filter(p => p.supervisor===nombre).map(p => ({...p, _est: estadoProg(p)}));
  const pendientes = mias.filter(p => p._est.key!=='ejecutada');
  const vencidas = pendientes.filter(p => p._est.key==='vencida');
  const proximas = pendientes.filter(p => p._est.key==='proxima' && p._est.dias<=3);
  const misRegs = registros.filter(r => r.supervisor===nombre);

  setText('skPendientes', pendientes.length);
  setText('skProximas', proximas.length);
  setText('skVencidas', vencidas.length);
  setText('skEjecutadas', misRegs.length);

  const ncSup = document.getElementById('navCountSup');
  if(ncSup) {
    const n = vencidas.length + pendientes.filter(p=>p._est.key==='hoy'||p._est.key==='curso').length;
    ncSup.style.display = n ? 'inline-flex' : 'none';
    ncSup.textContent = n;
  }

  // Lista de programaciones del supervisor
  const div = document.getElementById('supProgramaciones');
  if(div) {
    const orden = {vencida:0, curso:1, hoy:1, proxima:2, ejecutada:3};
    const lista = [...mias].sort((a,b) => orden[a._est.key]-orden[b._est.key] || (a.fechaProgramada||'').localeCompare(b.fechaProgramada||''));
    if(!lista.length) div.innerHTML = '<p class="empty-msg">No tienes capacitaciones programadas aún.</p>';
    else div.innerHTML = lista.map(p => {
      const rg = rangoProg(p);
      const d = new Date(rg.ini+'T12:00:00');
      const MESES=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
      const cls = p._est.key==='vencida'?'vencida':(p._est.key==='hoy'||p._est.key==='curso')?'hoy-curso':p._est.key==='ejecutada'?'ejecutada':'proxima';
      const fechasTxt = rg.ini===rg.fin ? formatDateDisplay(rg.ini) : `${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)} (${rg.dias} días)`;
      return `<div class="prog-card ${cls}">
        <div class="prog-card-fecha"><div class="pcf-dia">${d.getDate()}</div><div class="pcf-mes">${MESES[d.getMonth()]}</div></div>
        <div class="prog-card-info">
          <div class="prog-card-tema">${esc(p.tema)}</div>
          <div class="prog-card-meta">${esc(p.sector||'')} · Fechas: ${fechasTxt}${p.observaciones?`<br>Nota: ${esc(p.observaciones)}`:''}</div>
        </div>
        <span class="badge ${p._est.badge}">${p._est.label}${p._est.key==='vencida'?` · ${p._est.dias} día(s) de atraso`:p._est.key==='proxima'?` · en ${p._est.dias} día(s)`:''}</span>
        ${p._est.key!=='ejecutada' ? `<button class="btn btn-primary btn-sm" onclick="abrirRegistroSup('${p.id}')"><svg class="ico sm"><use href="#i-plus"/></svg> Registrar</button>` : ''}
      </div>`;
    }).join('');
  }

  // Mis registros enviados
  const rDiv = document.getElementById('supMisRegistros');
  if(rDiv) {
    if(!misRegs.length) rDiv.innerHTML = '<p class="empty-msg">Aún no has registrado capacitaciones.</p>';
    else rDiv.innerHTML = misRegs.slice(0,10).map(r => `
      <div class="alert-card alert-verde">
        <span class="alert-icon"><svg class="ico"><use href="#i-check-circle"/></svg></span>
        <div><strong>${esc(r.tema)}</strong> · ${formatDateDisplay(r.fechaEjecucion)}<br>
        ${r.total||0} trabajadores (${r.varones||0} V · ${r.mujeres||0} M)${(r.codigosCapacitados||[]).length?` · ${r.codigosCapacitados.length} códigos`:''}${r.rutasTexto?` · Rutas: ${esc(r.rutasTexto)}`:''}</div>
      </div>`).join('');
  }

  // Aviso permanente + apertura automática del formulario
  renderAvisoSupervisor(pendientes);
}

// Elige la programación pendiente más urgente del supervisor
function progMasUrgente(pendientes) {
  const orden = {vencida:0, curso:1, hoy:1, proxima:2};
  const lista = [...pendientes].sort((a,b) => {
    const d = orden[a._est.key]-orden[b._est.key];
    if(d!==0) return d;
    if(a._est.key==='vencida') return b._est.dias-a._est.dias; // más atrasada primero
    return (a._est.dias||0)-(b._est.dias||0); // más cercana primero
  });
  return lista[0] || null;
}

// Banner de aviso al supervisor + abrir su formulario automáticamente al entrar
function renderAvisoSupervisor(pendientes) {
  const banner = document.getElementById('supAvisoBanner');
  if(!banner) return;
  const urgente = progMasUrgente(pendientes);
  if(!urgente) { banner.style.display='none'; return; }

  const rg = rangoProg(urgente);
  const fechasTxt = rg.fechas.map(f=>formatDateDisplay(f)).join(', ');
  const esVencida = urgente._est.key==='vencida';
  banner.className = 'alert-card ' + (esVencida ? 'alert-rojo' : 'alert-amarillo');
  banner.style.display = 'flex';
  banner.innerHTML = `
    <span class="alert-icon"><svg class="ico"><use href="#i-bell"/></svg></span>
    <div style="line-height:1.65;">
      <strong style="font-size:13px;">${esVencida ? '🚨 Tienes una capacitación programada VENCIDA' : '📋 Tienes una capacitación programada'}</strong><br>
      <strong>${esc(urgente.tema)}</strong> · ${esc(urgente.sector||'')} — fecha(s): <strong>${fechasTxt}</strong>${esVencida?` · <strong style="color:var(--rojo);">${urgente._est.dias} día(s) hábil(es) de atraso</strong>`:''}.<br>
      Por favor registra los datos solicitados en el formulario. Si aún no la has realizado, recuerda que
      <strong>se está evaluando el cumplimiento y la responsabilidad de las actividades programadas</strong>.
      <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="abrirRegistroSup('${urgente.id}')"><svg class="ico sm"><use href="#i-plus"/></svg> Registrar ahora</button></div>
    </div>`;

  // Al iniciar sesión: abrir el formulario automáticamente (una sola vez)
  if(!avisoSupMostrado && dataProgCargada) {
    avisoSupMostrado = true;
    setTimeout(() => abrirRegistroSup(urgente.id), 600);
  }
}

window.abrirRegistroSup = function(id) {
  const p = programaciones.find(x => x.id===id);
  if(!p) return;
  const rg = rangoProg(p);
  document.getElementById('sProgId').value = id;
  document.getElementById('sFechaEjec').value = rg.fin <= formatDate(new Date()) ? rg.fin : formatDate(new Date());
  document.getElementById('supProgInfo').style.display='flex';
  document.getElementById('supProgInfoTxt').innerHTML = `Registrando: <strong>${esc(p.tema)}</strong> · ${esc(p.sector||'')} · fechas designadas: <strong>${rg.fechas.map(f=>formatDateDisplay(f)).join(' · ')}</strong>`;
  document.getElementById('supFormPanel').style.display='block';
  document.getElementById('supFormPanel').scrollIntoView({behavior:'smooth', block:'start'});
};

async function guardarRegistroSupervisor() {
  const progId = document.getElementById('sProgId').value;
  const p = programaciones.find(x => x.id===progId);
  if(!p) { showToast('Selecciona una programación de la lista (botón Registrar).', true); return; }
  const fechaE = document.getElementById('sFechaEjec').value;
  const vTxt = document.getElementById('sVarones').value;
  const mTxt = document.getElementById('sMujeres').value;
  if(!fechaE || vTxt==='' || mTxt==='') { showToast('Completa fecha, varones y mujeres.', true); return; }
  const v = parseInt(vTxt)||0, m = parseInt(mTxt)||0;
  if(v+m<=0) { showToast('El total de capacitados debe ser mayor a 0.', true); return; }
  const rutasTxt = document.getElementById('sRutas').value.trim();
  const codigos = parseCodigos(document.getElementById('sCodigos').value);
  const obs = document.getElementById('sObs').value.trim();
  const {fechaLimite, temporada} = calcularFechaLimite(fechaE);

  const reg = {
    supervisor: p.supervisor, sector: p.sector||'', varones:v, mujeres:m, total:v+m,
    tema: p.tema, fechaEjecucion: fechaE, fechaLimite, temporada,
    fechaEnvio: null, observaciones: obs,
    tipoPersonal:'', rutasTipo: rutasTxt?'texto':'ninguna', rutas:[], rutasTexto: rutasTxt,
    areas:[], codigosCapacitados: codigos,
    registradoPor: usuarioActual.nombre, viaSupervisor: true,
    creadoEn: new Date().toISOString()
  };
  try {
    const refDoc = await addDoc(collection(db, COL), reg);
    try { await updateDoc(doc(db, COL_PROG, progId), {estado:'ejecutada', registroId:refDoc.id, ejecutadaEn:new Date().toISOString()}); }
    catch(e2) { console.error('Error al marcar programación:', e2); }
    cerrarFormSup();
    showToast('✅ Capacitación registrada. ¡Gracias! Relaciones Laborales ya puede verla.');
  } catch(e) {
    console.error(e);
    showToast('❌ Error al guardar. Verifica tu conexión.', true);
  }
}

// ════════════════════════════════════════════════
//  GESTIÓN DE CUENTAS DE USUARIOS (ADMIN)
// ════════════════════════════════════════════════
function escucharUsuarios() {
  if(usuarioActual?.rol !== 'admin') return;
  const q = query(collection(db, COL_USERS), orderBy('supervisorNombre'));
  unsubUsers = onSnapshot(q, snap => {
    usuariosCuentas = snap.docs.map(d => ({id:d.id, ...d.data()}));
    renderListaUsuarios();
  }, err => console.error('Users error:', err));
}

function initUsuariosAdmin() {
  document.getElementById('btnUserGuardar')?.addEventListener('click', guardarUsuario);
  document.getElementById('btnUserSugerir')?.addEventListener('click', sugerirCredenciales);
  document.getElementById('btnUsersExcel')?.addEventListener('click', exportUsuariosExcel);
}

function sugerirCredenciales() {
  const nombre = document.getElementById('uSupervisor').value;
  if(!nombre) { showToast('Primero elige el supervisor.', true); return; }
  const partes = nombre.trim().toLowerCase().split(/\s+/);
  let base = (partes[0][0]||'') + (partes[1]||partes[0]);
  base = base.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  let usuario = base, n = 2;
  const existe = u => usuariosCuentas.some(c => c.usuario===u) || USUARIOS.some(c => c.usuario===u);
  while(existe(usuario)) { usuario = base + n; n++; }
  document.getElementById('uUsuario').value = usuario;
  document.getElementById('uPassword').value = usuario + new Date().getFullYear();
}

async function guardarUsuario() {
  if(usuarioActual?.rol !== 'admin') { showToast('Solo administradores.', true); return; }
  const supervisorNombre = document.getElementById('uSupervisor').value;
  const usuario = document.getElementById('uUsuario').value.trim().toLowerCase();
  const password = document.getElementById('uPassword').value.trim();
  if(!supervisorNombre || !usuario || !password) { showToast('Completa supervisor, usuario y contraseña.', true); return; }
  if(password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', true); return; }
  if(usuariosCuentas.some(c => c.usuario===usuario) || USUARIOS.some(c => c.usuario===usuario)) {
    showToast('⚠️ Ese nombre de usuario ya existe. Elige otro.', true); return;
  }
  try {
    await addDoc(collection(db, COL_USERS), {
      usuario, password, supervisorNombre,
      estado:'activo', creadoPor: usuarioActual.nombre, creadoEn: new Date().toISOString()
    });
    document.getElementById('uSupervisor').value='';
    document.getElementById('uUsuario').value='';
    document.getElementById('uPassword').value='';
    showToast(`✅ Cuenta creada para ${supervisorNombre} (usuario: ${usuario})`);
  } catch(e) { console.error(e); showToast('❌ Error al crear la cuenta.', true); }
}

function renderListaUsuarios() {
  const div = document.getElementById('listaUsuarios');
  if(!div) return;
  if(!usuariosCuentas.length) { div.innerHTML='<p class="empty-msg">Sin cuentas registradas aún. Crea la primera arriba.</p>'; return; }
  div.innerHTML = usuariosCuentas.map(c => `
    <div class="user-row ${c.estado==='inactivo'?'inactivo':''}">
      <div class="user-row-avatar">${iniciales(c.supervisorNombre)}</div>
      <div class="user-row-info">
        <div class="user-row-nombre">${esc(c.supervisorNombre)} ${c.estado==='inactivo'?'<span style="color:var(--rojo);font-size:10px;font-weight:700;">· INACTIVA</span>':''}</div>
        <div class="user-row-meta">Usuario: <code>${esc(c.usuario)}</code> · Contraseña: <code>${esc(c.password)}</code></div>
      </div>
      <div style="display:flex;gap:5px;">
        <button class="btn btn-secondary btn-sm" onclick="resetPassUsuario('${c.id}')" title="Cambiar contraseña"><svg class="ico sm"><use href="#i-key"/></svg></button>
        ${c.estado==='inactivo'
          ? `<button class="btn btn-success btn-sm" onclick="toggleUsuario('${c.id}','activo')" title="Reactivar"><svg class="ico sm"><use href="#i-check"/></svg></button>`
          : `<button class="btn btn-danger btn-sm" onclick="toggleUsuario('${c.id}','inactivo')" title="Desactivar acceso"><svg class="ico sm"><use href="#i-lock"/></svg></button>`}
        <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${c.id}')" title="Eliminar cuenta"><svg class="ico sm"><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join('');
}

window.toggleUsuario = async function(id, estado) {
  if(usuarioActual?.rol !== 'admin') return;
  try { await updateDoc(doc(db, COL_USERS, id), {estado}); showToast(estado==='activo'?'✅ Cuenta reactivada':'⛔ Cuenta desactivada — ya no podrá iniciar sesión'); }
  catch(e) { showToast('Error', true); }
};

window.resetPassUsuario = async function(id) {
  if(usuarioActual?.rol !== 'admin') return;
  const c = usuariosCuentas.find(x => x.id===id);
  if(!c) return;
  const nueva = prompt(`Nueva contraseña para ${c.supervisorNombre} (usuario: ${c.usuario}):`, c.password);
  if(!nueva || nueva.trim().length < 6) { if(nueva!==null) showToast('Mínimo 6 caracteres.', true); return; }
  try { await updateDoc(doc(db, COL_USERS, id), {password: nueva.trim()}); showToast('🔑 Contraseña actualizada'); }
  catch(e) { showToast('Error', true); }
};

window.eliminarUsuario = async function(id) {
  if(usuarioActual?.rol !== 'admin') return;
  if(!confirm('¿Eliminar esta cuenta de acceso? El supervisor y su historial se conservan.')) return;
  try { await deleteDoc(doc(db, COL_USERS, id)); showToast('🗑 Cuenta eliminada'); }
  catch(e) { showToast('Error', true); }
};

function exportUsuariosExcel() {
  if(!usuariosCuentas.length) { showToast('Sin cuentas para exportar', true); return; }
  const data = usuariosCuentas.map(c => ({
    'Supervisor': c.supervisorNombre, 'Usuario': c.usuario, 'Contraseña': c.password,
    'Estado': c.estado||'activo', 'Creada': (c.creadoEn||'').substring(0,10)
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Credenciales ETI');
  XLSX.writeFile(wb, `ETI_Credenciales_${formatDate(new Date())}.xlsx`);
  showToast('📥 Credenciales exportadas. Entrégalas de forma segura a cada supervisor.');
}
