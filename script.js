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
const COL_SUPS = 'supervisores_eti';
const COL_PROG = 'programaciones_eti';

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
  { usuario:'gcastillo', nombre:'Lucia Castillo Gonzalez', password:'gcastillo2026', rol:'usuario' }
];

const FESTIVOS_PERU = ['01-01','04-17','04-18','05-01','06-29','07-28','07-29','08-30','10-08','11-01','12-08','12-09','12-25'];

// ─── SECCIONES DE EVALUACIÓN (pesos fijos, verde ≥ 70% de la sección) ──
const SECCIONES_EVAL = [
  {key:'legislacion',    nombre:'DE LEGISLACIÓN LABORAL',              corto:'Legislación\nLaboral',    peso:18},
  {key:'bienestar',      nombre:'DE BIENESTAR SOCIAL',                 corto:'Bienestar\nSocial',       peso:32},
  {key:'etica',          nombre:'DE ÉTICA EMPRESARIAL',                corto:'Ética\nEmpresarial',      peso:6},
  {key:'seguridad',      nombre:'DE SEGURIDAD Y SALUD EN EL TRABAJO',  corto:'Seguridad\ny Salud',      peso:12},
  {key:'medioambiente',  nombre:'DE COMPROMISO MEDIOAMBIENTAL',        corto:'Compromiso\nMedioamb.',   peso:16},
  {key:'sustentabilidad',nombre:'DE SUSTENTABILIDAD',                  corto:'Sustenta-\nbilidad',      peso:16}
];
const UMBRAL_VERDE = 0.7; // 70% del peso de la sección
// Colores del semáforo (informe)
const SEM_COLORES = {
  verdeFuerte:'#1F9D44', verdeClaro:'#d6f5df', rojoFuerte:'#E00000', rojoClaro:'#ffd9d9',
  amarillo:'#FFFF00', grisHead:'#d9d9d9', grisFila:'#f2f2f2'
};

let registros = [];
let supervisores = [];
let programaciones = [];
let usuarioActual = null;
let unsubscribe = null;
let unsubSups = null;
let unsubProg = null;
let destiempoInfo = null;   // datos confirmados del modal de destiempo (evaluaciones)
let dProgActual = null;     // programación en evaluación dentro del modal
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
  initProgramacion();
  escucharFirebase();
  escucharSupervisores();
  escucharProgramaciones();
}

function cerrarSesion() {
  if(unsubscribe) { unsubscribe(); unsubscribe=null; }
  if(unsubSups) { unsubSups(); unsubSups=null; }
  if(unsubProg) { unsubProg(); unsubProg=null; }
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
    actualizarBannerEvalProg();
  });

  // Tema → mostrar tipo personal y bloque de notas de evaluación
  document.getElementById('fTema').addEventListener('change', function() {
    document.getElementById('bloqueTipoPersonal').style.display=this.value?'block':'none';
    document.getElementById('bloqueEvalSecciones').style.display=this.value==='EVALUACIONES DE CHECKLIST'?'block':'none';
    actualizarBannerEvalProg();
  });

  document.getElementById('evNumRutas').addEventListener('input', generarEvalGrid);

  // Modal destiempo: recalcular tipo al cambiar la fecha real
  document.getElementById('dFechaReal').addEventListener('change', actualizarTipoDestiempo);
  document.querySelectorAll('input[name="dReporto"]').forEach(r => {
    r.addEventListener('change', function() {
      document.querySelectorAll('input[name="dReporto"]').forEach(x=>x.closest('.radio-chip').classList.remove('selected'));
      this.closest('.radio-chip').classList.add('selected');
    });
  });
  document.getElementById('modalDestiempo').addEventListener('click', function(e){ if(e.target===this) cerrarDestiempo(); });

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
  document.getElementById('fFechaEjecucion').addEventListener('change', actualizarBannerEvalProg);
}

// ─── CONTROL DE DESTIEMPO (EVALUACIONES) ─────────────────────
// Busca la programación de EVALUACIONES pendiente/vencida del supervisor
function buscarProgEvaluacion(supervisor, sector) {
  const progIdVinc = document.getElementById('fProgId').value;
  if(progIdVinc) {
    const pv = programaciones.find(x => x.id===progIdVinc && x.tema==='EVALUACIONES DE CHECKLIST');
    if(pv) return pv;
  }
  const cands = programaciones.filter(p =>
    p.tema==='EVALUACIONES DE CHECKLIST' &&
    p.estado!=='ejecutada' &&
    p.supervisor===supervisor &&
    (!sector || !p.sector || p.sector===sector)
  );
  if(!cands.length) return null;
  cands.sort((a,b) => (a.fechaProgramada||'').localeCompare(b.fechaProgramada||''));
  return cands[0];
}

// Banner informativo en el formulario de registro
function actualizarBannerEvalProg() {
  const banner = document.getElementById('evalProgBanner');
  const texto = document.getElementById('evalProgTexto');
  if(!banner) return;
  const supVal = document.getElementById('fSupervisor').value;
  const tema = document.getElementById('fTema').value;
  if(tema!=='EVALUACIONES DE CHECKLIST' || !supVal) { banner.style.display='none'; return; }
  const [supervisor, sector] = supVal.split('|');
  const prog = buscarProgEvaluacion(supervisor, sector);
  if(!prog) { banner.style.display='none'; return; }
  const fechasP = fechasDeProg(prog);
  const hoyStr = formatDate(new Date());
  const vencida = hoyStr > fechasP[fechasP.length-1];
  texto.innerHTML = `<strong>${vencida?'🚨 Evaluaciones programadas VENCIDAS':'📅 Este supervisor tiene evaluaciones programadas'}</strong> para: <strong>${fechasP.map(formatDateDisplay).join(', ')}</strong>.` +
    (vencida ? ' Al guardar se te pedirá justificar el <strong>destiempo</strong>.' : '');
  banner.style.display='flex';
}

function abrirDestiempo(prog, fechasP, fechaEjecIngresada) {
  dProgActual = { prog, fechasP };
  const fechasTxt = fechasP.map(formatDateDisplay).join(', ');
  document.getElementById('dMensajeProg').innerHTML =
    `<strong>⚠️ Estás registrando A DESTIEMPO.</strong><br>` +
    `La fecha de registro de tus evaluaciones estaba programada para el: <strong>${fechasTxt}</strong> ` +
    `(Supervisor: <strong>${esc(prog.supervisor)}</strong> · ${esc(prog.sector||'')}).<br>` +
    `Para continuar, registra la fecha en la cual ejecutaste las evaluaciones.`;
  document.getElementById('dFechaReal').value = fechaEjecIngresada || '';
  document.getElementById('dMotivo').value = '';
  document.getElementById('dDetalle').value = '';
  document.querySelectorAll('input[name="dReporto"]').forEach(x => { x.checked=false; x.closest('.radio-chip').classList.remove('selected'); });
  actualizarTipoDestiempo();
  document.getElementById('modalDestiempo').classList.add('open');
}

function actualizarTipoDestiempo() {
  const banner = document.getElementById('dTipoBanner');
  const texto = document.getElementById('dTipoTexto');
  const f = document.getElementById('dFechaReal').value;
  if(!f || !dProgActual) { banner.style.display='none'; return; }
  const misma = dProgActual.fechasP.includes(f);
  banner.style.display='flex';
  if(misma) {
    texto.innerHTML = '📌 Ejecutaste en la <strong>misma fecha programada</strong>, pero el registro es tardío. Indica <strong>por qué el destiempo</strong> en el registro.';
    document.getElementById('dMotivoLabel').textContent = 'Motivo del destiempo (registro tardío) *';
  } else {
    texto.innerHTML = '🔄 Ejecutaste en una <strong>fecha distinta a la programada</strong>. Indica el <strong>motivo del retraso o cambio de fecha</strong>.';
    document.getElementById('dMotivoLabel').textContent = 'Motivo del retraso / cambio de fecha *';
  }
}

window.cerrarDestiempo = function() {
  document.getElementById('modalDestiempo').classList.remove('open');
  dProgActual = null;
};

window.confirmarDestiempo = function() {
  if(!dProgActual) return;
  const f = document.getElementById('dFechaReal').value;
  const motivo = document.getElementById('dMotivo').value;
  const detalle = document.getElementById('dDetalle').value.trim();
  const rep = document.querySelector('input[name="dReporto"]:checked');
  if(!f) { showToast('⚠️ Registra la fecha en la cual ejecutaste las evaluaciones.', true); return; }
  const misma = dProgActual.fechasP.includes(f);
  if(!motivo) {
    showToast(misma ? '⚠️ Indica por qué el destiempo en el registro.' : '⚠️ Indica el motivo del retraso o cambio de fecha.', true);
    return;
  }
  if(!rep) { showToast('⚠️ Marca SÍ o NO: ¿reportaste a tu coordinador?', true); return; }
  destiempoInfo = {
    progId: dProgActual.prog.id,
    fechaProgramada: dProgActual.fechasP[0],
    fechasProgramadas: dProgActual.fechasP,
    esDestiempo: true,
    tipoDestiempo: misma ? 'REGISTRO TARDÍO (MISMA FECHA)' : 'CAMBIO DE FECHA',
    motivoDestiempo: motivo + (detalle ? ' — ' + detalle : ''),
    reportadoCoordinador: rep.value
  };
  document.getElementById('fFechaEjecucion').value = f;
  verificarRetrasoForm();
  cerrarDestiempo();
  guardarRegistro();
};

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

// ─── GRILLA DE NOTAS DE EVALUACIÓN (por ruta y sección) ──────
function generarEvalGrid() {
  const n = Math.min(parseInt(document.getElementById('evNumRutas').value)||0, 30);
  const table = document.getElementById('evalGridTable');
  const head = document.getElementById('evalGridHead');
  const body = document.getElementById('evalGridBody');
  if(n<1){ table.style.display='none'; head.innerHTML=''; body.innerHTML=''; return; }
  table.style.display='table';
  head.innerHTML = '<tr><th style="min-width:130px;">Ruta</th><th style="min-width:60px;">Cód.</th>' +
    SECCIONES_EVAL.map(s=>`<th style="min-width:78px;font-size:9.5px;">${esc(s.nombre.replace(/^DE /,''))}<br><small>(máx ${s.peso})</small></th>`).join('') + '</tr>';
  // Conservar valores ya escritos
  const prev = obtenerEvalResultados(true);
  let html='';
  for(let i=0;i<n;i++){
    const p = prev[i]||{};
    html += `<tr>
      <td><input type="text" class="ev-ruta" placeholder="Ej: LA GREDA" value="${esc(p.ruta||'')}" style="width:100%;min-width:120px;text-transform:uppercase;" /></td>
      <td><input type="text" class="ev-cod" placeholder="Cód." value="${esc(p.cod||'')}" style="width:60px;" /></td>` +
      SECCIONES_EVAL.map(s=>{
        const v = p.notas && p.notas[s.key]!=null ? p.notas[s.key] : '';
        return `<td><input type="number" class="ev-nota" data-sec="${s.key}" min="0" max="${s.peso}" step="0.01" placeholder="0-${s.peso}" value="${v}" style="width:70px;" /></td>`;
      }).join('') + '</tr>';
  }
  body.innerHTML = html;
}

// Lee la grilla; incluirVacias=true conserva filas incompletas (para regenerar)
function obtenerEvalResultados(incluirVacias) {
  const filas=[];
  document.querySelectorAll('#evalGridBody tr').forEach(tr => {
    const ruta=(tr.querySelector('.ev-ruta')?.value||'').trim().toUpperCase();
    const cod=(tr.querySelector('.ev-cod')?.value||'').trim();
    const notas={};
    let tiene=false;
    tr.querySelectorAll('.ev-nota').forEach(inp => {
      const v=inp.value==='' ? null : parseFloat(inp.value);
      notas[inp.dataset.sec]=isNaN(v)?null:v;
      if(notas[inp.dataset.sec]!=null) tiene=true;
    });
    if(ruta || cod || tiene || incluirVacias) filas.push({ruta,cod,notas});
  });
  return incluirVacias ? filas : filas.filter(f=>f.ruta||f.cod);
}

// Resumen: promedio por sección + total del grupo (los pesos suman 100)
function calcularResumenEval(resultados) {
  const porSeccion={};
  SECCIONES_EVAL.forEach(s => {
    const vals=resultados.map(r=>r.notas?r.notas[s.key]:null).filter(v=>v!=null);
    porSeccion[s.key]=vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100 : null;
  });
  const conValor=SECCIONES_EVAL.filter(s=>porSeccion[s.key]!=null);
  const total=conValor.reduce((a,s)=>a+porSeccion[s.key],0);
  const pesoEval=conValor.reduce((a,s)=>a+s.peso,0);
  const totalPct=pesoEval ? Math.round((total/pesoEval)*1000)/10 : null; // % sobre lo evaluado
  return {porSeccion, totalPct};
}

function esVerdeSeccion(valor, peso){ return valor!=null && valor >= peso*UMBRAL_VERDE; }

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

  // ── Control de destiempo: solo EVALUACIONES DE CHECKLIST con programación ──
  if(tema==='EVALUACIONES DE CHECKLIST' && !destiempoInfo) {
    const [supChk, secChk] = supVal.split('|');
    const progEval = buscarProgEvaluacion(supChk, secChk);
    if(progEval) {
      const fechasP = fechasDeProg(progEval);
      const hoyStr = formatDate(new Date());
      const enFecha = fechasP.includes(fechaE) && hoyStr <= fechasP[fechasP.length-1];
      if(enFecha) {
        destiempoInfo = {
          progId: progEval.id, fechaProgramada: fechasP[0], fechasProgramadas: fechasP,
          esDestiempo: false, tipoDestiempo: '', motivoDestiempo: '', reportadoCoordinador: ''
        };
      } else {
        abrirDestiempo(progEval, fechasP, fechaE);
        return; // el guardado continúa al confirmar el modal
      }
    }
  }

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

  // Notas de evaluación por ruta/sección (solo evaluaciones)
  let evalResultados=[];
  if(tema==='EVALUACIONES DE CHECKLIST'){
    evalResultados=obtenerEvalResultados(false);
    for(const f of evalResultados){
      for(const s of SECCIONES_EVAL){
        const val=f.notas[s.key];
        if(val!=null && (val<0 || val>s.peso)){
          showToast(`⚠️ Ruta ${f.ruta||'?'}: la nota de "${s.nombre}" debe estar entre 0 y ${s.peso}.`,true);
          return;
        }
      }
    }
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
    // Resultados de evaluación por ruta y sección
    evalResultados,
    // Control de destiempo (evaluaciones programadas)
    fechaProgramada: destiempoInfo?destiempoInfo.fechaProgramada:null,
    fechasProgramadas: destiempoInfo?destiempoInfo.fechasProgramadas:[],
    esDestiempo: destiempoInfo?destiempoInfo.esDestiempo:false,
    tipoDestiempo: destiempoInfo?destiempoInfo.tipoDestiempo:'',
    motivoDestiempo: destiempoInfo?destiempoInfo.motivoDestiempo:'',
    reportadoCoordinador: destiempoInfo?destiempoInfo.reportadoCoordinador:'',
    registradoPor:usuarioActual?usuarioActual.nombre:'',
    creadoEn:new Date().toISOString()
  };
  try {
    const refDoc = await addDoc(collection(db,COL),reg);
    // Si viene de una programación (vinculada o detectada por destiempo), marcarla como ejecutada
    const progId = document.getElementById('fProgId').value || (destiempoInfo?destiempoInfo.progId:'') || '';
    if(progId) {
      try { await updateDoc(doc(db, COL_PROG, progId), {estado:'ejecutada', registroId:refDoc.id, ejecutadaEn:new Date().toISOString()}); }
      catch(e2) { console.error('Error al marcar programación:', e2); }
    }
    if(reg.esDestiempo) showToast('✅ Registro guardado con control de DESTIEMPO justificado.', false);
    else showToast(progId ? '✅ Registro guardado y programación marcada como ejecutada.' : '✅ Registro guardado correctamente.', false);
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
  document.getElementById('fProgId').value='';
  document.getElementById('progVinculadaBanner').style.display='none';
  document.getElementById('evalProgBanner').style.display='none';
  document.getElementById('bloqueEvalSecciones').style.display='none';
  document.getElementById('evNumRutas').value='';
  document.getElementById('evalGridTable').style.display='none';
  document.getElementById('evalGridHead').innerHTML='';
  document.getElementById('evalGridBody').innerHTML='';
  destiempoInfo=null;
  dProgActual=null;
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

  // Semáforo global + tendencias vs mes anterior
  renderSemaforo(pctCumpl);
  renderTendencias(conEstado);

  // Alertas de programación
  renderAlertasProg();

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
      <td style="font-size:10.5px;">${esc(r.tema)}${r.esDestiempo?'<br><span class="badge badge-rojo" style="font-size:9px;" title="Registro a destiempo · '+esc(r.tipoDestiempo||'')+'">⏰ Destiempo</span>':''}${(r.evalResultados&&r.evalResultados.length)?(()=>{const p=calcularResumenEval(r.evalResultados).totalPct;return p==null?'':'<br><span class="badge '+(p>=70?'badge-verde':'badge-rojo')+'" style="font-size:9px;" title="Resultado general de la evaluación">📊 '+p+'%</span>';})():''}</td>
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

  // Bloque de control de destiempo (evaluaciones programadas)
  let destHtml='';
  if(r.fechaProgramada||r.esDestiempo){
    const fechasProgTxt=(r.fechasProgramadas&&r.fechasProgramadas.length)?r.fechasProgramadas.map(formatDateDisplay).join(', '):formatDateDisplay(r.fechaProgramada);
    destHtml=`
      <div class="det-item"><div class="det-label">Fecha(s) Programada(s) de Evaluación</div><div class="det-value">📅 ${fechasProgTxt}</div></div>
      <div class="det-item"><div class="det-label">Registro a Destiempo</div><div class="det-value">${r.esDestiempo?`<span class="badge badge-rojo">⏰ SÍ</span> ${esc(r.tipoDestiempo||'')}`:'<span class="badge badge-verde">✅ NO (en fecha)</span>'}</div></div>
      ${r.esDestiempo?`
      <div class="det-item full"><div class="det-label">Motivo del Destiempo / Cambio de Fecha</div><div class="det-value" style="font-weight:400;">${esc(r.motivoDestiempo||'–')}</div></div>
      <div class="det-item"><div class="det-label">¿Reportado al Coordinador?</div><div class="det-value">${r.reportadoCoordinador==='SI'?'<span class="badge badge-verde">✅ SÍ</span>':'<span class="badge badge-rojo">❌ NO</span>'}</div></div>`:''}`;
  }

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
      ${destHtml}${rutasHtml}${areasHtml}
      ${r.observaciones?`<div class="det-item full"><div class="det-label">Observaciones</div><div class="det-value" style="font-weight:400;">${esc(r.observaciones)}</div></div>`:''}
      ${(r.evalResultados&&r.evalResultados.length)?`
      <div class="det-item full">
        <div class="det-label">📊 Detalle de Resultados de la Evaluación</div>
        <div style="margin-top:8px;">${buildCuadrosEvalHTML(r)}</div>
        <div class="actions-row" style="margin-top:10px;">
          <button class="btn btn-pdf btn-sm" onclick="exportEvalPDF('${r.id}')">📄 Informe PDF</button>
          <button class="btn btn-excel btn-sm" onclick="exportEvalExcel('${r.id}')">📥 Excel</button>
        </div>
      </div>`:''}
    </div>`;
  document.getElementById('modalDetalle').classList.add('open');
};
window.cerrarDetalle=function(){document.getElementById('modalDetalle').classList.remove('open');};

// ─── INFORME DETALLADO DE EVALUACIÓN (cuadros semáforo) ───────
// Construye los 2 cuadros en HTML con estilos inline (pantalla + Excel)
function buildCuadrosEvalHTML(r) {
  const res=calcularResumenEval(r.evalResultados||[]);
  const C=SEM_COLORES;
  const th='padding:6px 8px;border:1px solid #888;font-size:11px;text-align:center;font-weight:700;';
  const td='padding:5px 8px;border:1px solid #888;font-size:11px;';

  // ── CUADRO 1: Resultados por sección (general del grupo) ──
  let c1=`<table style="border-collapse:collapse;width:100%;margin-bottom:18px;">
    <tr>
      <th style="${th}background:${C.grisHead};">SECCIÓN</th>
      <th style="${th}background:${C.grisHead};">RESULTADO</th>
      <th style="${th}background:${C.rojoFuerte};color:#fff;">ROJO</th>
      <th style="${th}background:${C.verdeFuerte};color:#fff;">VERDE</th>
      <th style="${th}background:${C.amarillo};">%R</th>
    </tr>`;
  SECCIONES_EVAL.forEach(s=>{
    const val=res.porSeccion[s.key];
    const lim=Math.round(s.peso*UMBRAL_VERDE*100)/100;
    const verde=esVerdeSeccion(val,s.peso);
    const fondo=val==null?'#fff':(verde?C.verdeFuerte:C.rojoFuerte);
    c1+=`<tr>
      <td style="${td}background:${C.grisFila};font-weight:600;">${esc(s.nombre)}</td>
      <td style="${td}text-align:center;font-weight:700;background:${fondo};color:${val==null?'#333':'#fff'};">${val==null?'':val}</td>
      <td style="${td}text-align:center;">0 - ${(lim-0.01).toFixed(2)}%</td>
      <td style="${td}text-align:center;">${lim} - ${s.peso}%</td>
      <td style="${td}text-align:center;font-weight:700;">${s.peso}%</td>
    </tr>`;
  });
  const tPct=res.totalPct;
  const tVerde=tPct!=null && tPct>=70;
  c1+=`<tr>
    <td style="${td}background:#c9c9c9;font-weight:800;">GENERAL DEL GRUPO</td>
    <td style="${td}text-align:center;font-weight:800;background:${tPct==null?'#fff':(tVerde?C.verdeFuerte:C.rojoFuerte)};color:${tPct==null?'#333':'#fff'};">${tPct==null?'':tPct+'%'}</td>
    <td style="${td}text-align:center;font-weight:700;background:#c9c9c9;">0 - 69.9%</td>
    <td style="${td}text-align:center;font-weight:700;background:#c9c9c9;">70 - 100%</td>
    <td style="${td}text-align:center;font-weight:800;background:#c9c9c9;">100%</td>
  </tr></table>`;

  // ── CUADRO 2: Resultados por ruta ──
  let c2=`<table style="border-collapse:collapse;width:100%;">
    <tr>
      <th style="${th}background:${C.grisHead};min-width:140px;">RUTA</th>
      <th style="${th}background:${C.grisHead};">COD</th>` +
    SECCIONES_EVAL.map(s=>`<th style="${th}background:${C.grisHead};font-size:9.5px;">${esc(s.nombre)}</th>`).join('') + '</tr>';
  (r.evalResultados||[]).forEach(f=>{
    c2+=`<tr>
      <td style="${td}font-weight:600;">${esc(f.ruta||'–')}</td>
      <td style="${td}text-align:center;">${esc(f.cod||'')}</td>` +
      SECCIONES_EVAL.map(s=>{
        const val=f.notas?f.notas[s.key]:null;
        if(val==null) return `<td style="${td}"></td>`;
        const verde=esVerdeSeccion(val,s.peso);
        return `<td style="${td}text-align:center;font-weight:700;background:${verde?C.verdeClaro:C.rojoClaro};color:${verde?'#1a8040':'#cc0000'};">${val}</td>`;
      }).join('') + '</tr>';
  });
  c2+=`<tr>
    <td style="${td}background:#c9c9c9;font-weight:800;text-align:center;">GENERAL DEL GRUPO</td>
    <td style="${td}background:#c9c9c9;"></td>` +
    SECCIONES_EVAL.map(s=>{
      const val=res.porSeccion[s.key];
      if(val==null) return `<td style="${td}background:#c9c9c9;"></td>`;
      const verde=esVerdeSeccion(val,s.peso);
      return `<td style="${td}text-align:center;font-weight:800;background:${verde?C.verdeFuerte:C.rojoFuerte};color:#fff;">${Math.round(val*10)/10}</td>`;
    }).join('') + '</tr></table>';

  return `<div style="overflow-x:auto;">${c1}</div><div style="overflow-x:auto;">${c2}</div>`;
}

// Excel (.xls vía tabla HTML — conserva los colores del semáforo)
window.exportEvalExcel=function(id){
  const r=registros.find(x=>x.id===id);
  if(!r||!(r.evalResultados||[]).length){showToast('Este registro no tiene resultados de evaluación.',true);return;}
  const html=`<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>
    <h3>INFORME DE RESULTADOS — EVALUACIONES DE CHECKLIST</h3>
    <p>Supervisor: ${esc(r.supervisor)} · Sector: ${esc(r.sector||'–')} · Fecha de Ejecución: ${formatDateDisplay(r.fechaEjecucion)} · Sistema ETI v5.0 · Verfrut</p>
    ${buildCuadrosEvalHTML(r)}
  </body></html>`;
  const blob=new Blob(['﻿'+html],{type:'application/vnd.ms-excel'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`Informe_Evaluacion_${(r.supervisor||'').replace(/\s+/g,'_')}_${r.fechaEjecucion}.xls`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📥 Informe Excel de evaluación descargado');
};

// PDF (jsPDF horizontal con celdas coloreadas)
window.exportEvalPDF=function(id){
  const r=registros.find(x=>x.id===id);
  if(!r||!(r.evalResultados||[]).length){showToast('Este registro no tiene resultados de evaluación.',true);return;}
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('l','mm','a4');
  const res=calcularResumenEval(r.evalResultados);
  const verdeF=[31,157,68], verdeC=[214,245,223], rojoF=[224,0,0], rojoC=[255,217,217],
        amarillo=[255,255,0], grisH=[217,217,217], grisF=[242,242,242], grisG=[201,201,201],
        blanco=[255,255,255], negro=[40,40,40], blancoT=[255,255,255],
        verdeT=[26,128,64], rojoT=[204,0,0];
  let y=16;

  pdf.setFontSize(15); pdf.setTextColor(0,26,94); pdf.setFont(undefined,'bold');
  pdf.text('INFORME DE RESULTADOS — EVALUACIONES DE CHECKLIST',15,y); y+=6.5;
  pdf.setFontSize(9.5); pdf.setTextColor(80,80,80); pdf.setFont(undefined,'normal');
  pdf.text(`Supervisor: ${r.supervisor} · Sector: ${r.sector||'–'} · Fecha de Ejecución: ${formatDateDisplay(r.fechaEjecucion)} · Generado: ${formatDateDisplay(formatDate(new Date()))} · Sistema ETI v5.0`,15,y); y+=3.5;
  pdf.setDrawColor(0,26,94); pdf.line(15,y,282,y); y+=8;

  pdf.setLineWidth(0.2);
  const drawRow=(x0,yy,cells,h)=>{
    let x=x0;
    cells.forEach(c=>{
      pdf.setDrawColor(120,120,120);
      pdf.setFillColor(c.fill[0],c.fill[1],c.fill[2]);
      pdf.rect(x,yy,c.w,h,'FD');
      pdf.setTextColor(c.tc[0],c.tc[1],c.tc[2]);
      pdf.setFont(undefined,c.bold?'bold':'normal');
      pdf.setFontSize(c.fs||8.5);
      const lines=pdf.splitTextToSize(String(c.t==null?'':c.t),c.w-3);
      let ty=yy+h/2+1.2-(lines.length-1)*1.8;
      lines.forEach(l=>{
        if(c.align==='left') pdf.text(l,x+2,ty);
        else pdf.text(l,x+c.w/2,ty,{align:'center'});
        ty+=3.6;
      });
      x+=c.w;
    });
  };

  // ── CUADRO 1 ──
  pdf.setFontSize(11.5); pdf.setTextColor(0,26,94); pdf.setFont(undefined,'bold');
  pdf.text('1. RESULTADOS POR SECCIÓN — GENERAL DEL GRUPO',15,y); y+=4;
  const w1={sec:100,resu:40,rojo:42,verde:42,pr:25};
  drawRow(15,y,[
    {t:'SECCIÓN',w:w1.sec,fill:grisH,tc:negro,bold:true,align:'left'},
    {t:'RESULTADO',w:w1.resu,fill:grisH,tc:negro,bold:true},
    {t:'ROJO',w:w1.rojo,fill:rojoF,tc:blancoT,bold:true},
    {t:'VERDE',w:w1.verde,fill:verdeF,tc:blancoT,bold:true},
    {t:'%R',w:w1.pr,fill:amarillo,tc:negro,bold:true}
  ],8); y+=8;
  SECCIONES_EVAL.forEach(s=>{
    const val=res.porSeccion[s.key];
    const lim=Math.round(s.peso*UMBRAL_VERDE*100)/100;
    const verde=esVerdeSeccion(val,s.peso);
    drawRow(15,y,[
      {t:s.nombre,w:w1.sec,fill:grisF,tc:negro,bold:false,align:'left'},
      {t:val==null?'':val,w:w1.resu,fill:val==null?blanco:(verde?verdeF:rojoF),tc:val==null?negro:blancoT,bold:true},
      {t:`0 - ${(lim-0.01).toFixed(2)}%`,w:w1.rojo,fill:blanco,tc:negro},
      {t:`${lim} - ${s.peso}%`,w:w1.verde,fill:blanco,tc:negro},
      {t:s.peso+'%',w:w1.pr,fill:blanco,tc:negro,bold:true}
    ],8); y+=8;
  });
  const tPct=res.totalPct, tVerde=tPct!=null&&tPct>=70;
  drawRow(15,y,[
    {t:'GENERAL DEL GRUPO',w:w1.sec,fill:grisG,tc:negro,bold:true,align:'left'},
    {t:tPct==null?'':tPct+'%',w:w1.resu,fill:tPct==null?blanco:(tVerde?verdeF:rojoF),tc:tPct==null?negro:blancoT,bold:true},
    {t:'0 - 69.9%',w:w1.rojo,fill:grisG,tc:negro,bold:true},
    {t:'70 - 100%',w:w1.verde,fill:grisG,tc:negro,bold:true},
    {t:'100%',w:w1.pr,fill:grisG,tc:negro,bold:true}
  ],8); y+=15;

  // ── CUADRO 2 ──
  pdf.setFontSize(11.5); pdf.setTextColor(0,26,94); pdf.setFont(undefined,'bold');
  pdf.text('2. RESULTADOS POR RUTA',15,y); y+=4;
  const wRuta=60, wCod=18, wSec=31, rowH=9;
  const headCells=[
    {t:'RUTA',w:wRuta,fill:grisH,tc:negro,bold:true},
    {t:'COD',w:wCod,fill:grisH,tc:negro,bold:true}
  ].concat(SECCIONES_EVAL.map(s=>({t:s.nombre,w:wSec,fill:grisH,tc:negro,bold:true,fs:6.4})));
  drawRow(15,y,headCells,10); y+=10;
  r.evalResultados.forEach(f=>{
    if(y>186){ pdf.addPage(); y=16; drawRow(15,y,headCells,10); y+=10; }
    const cells=[
      {t:f.ruta||'–',w:wRuta,fill:blanco,tc:negro,bold:true,align:'left',fs:7.8},
      {t:f.cod||'',w:wCod,fill:blanco,tc:negro}
    ].concat(SECCIONES_EVAL.map(s=>{
      const val=f.notas?f.notas[s.key]:null;
      if(val==null) return {t:'',w:wSec,fill:blanco,tc:negro};
      const verde=esVerdeSeccion(val,s.peso);
      return {t:val,w:wSec,fill:verde?verdeC:rojoC,tc:verde?verdeT:rojoT,bold:true};
    }));
    drawRow(15,y,cells,rowH); y+=rowH;
  });
  if(y>186){ pdf.addPage(); y=16; }
  const genCells=[
    {t:'GENERAL DEL GRUPO',w:wRuta,fill:grisG,tc:negro,bold:true},
    {t:'',w:wCod,fill:grisG,tc:negro}
  ].concat(SECCIONES_EVAL.map(s=>{
    const val=res.porSeccion[s.key];
    if(val==null) return {t:'',w:wSec,fill:grisG,tc:negro};
    const verde=esVerdeSeccion(val,s.peso);
    return {t:Math.round(val*10)/10,w:wSec,fill:verde?verdeF:rojoF,tc:blancoT,bold:true};
  }));
  drawRow(15,y,genCells,rowH); y+=rowH;

  // Leyenda + firmas
  y+=8;
  if(y>175){ pdf.addPage(); y=20; }
  pdf.setFontSize(8.5); pdf.setTextColor(90,90,90); pdf.setFont(undefined,'normal');
  pdf.text('Criterio: VERDE = nota ≥ 70% del peso de la sección · ROJO = nota < 70% · General del grupo: promedio de rutas evaluadas.',15,y); y+=14;
  pdf.setDrawColor(150,150,150);
  pdf.line(30,y,100,y); pdf.line(180,y,250,y);
  pdf.setFontSize(9); pdf.setTextColor(80,80,80);
  pdf.text('Coordinador de Relaciones Laborales',38,y+5);
  pdf.text('Jefatura de Gestión Humana',192,y+5);

  pdf.save(`Informe_Evaluacion_${(r.supervisor||'').replace(/\s+/g,'_')}_${r.fechaEjecucion}.pdf`);
  showToast('📄 Informe PDF de evaluación descargado');
};

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
      'Resultado Evaluación (%)':(r.evalResultados&&r.evalResultados.length)?(calcularResumenEval(r.evalResultados).totalPct??''):'',
      'Fecha(s) Programada(s)':(r.fechasProgramadas&&r.fechasProgramadas.length)?r.fechasProgramadas.join('; '):(r.fechaProgramada||''),
      'Destiempo':r.esDestiempo?'SÍ':(r.fechaProgramada?'NO':''),
      'Tipo Destiempo':r.tipoDestiempo||'',
      'Motivo Destiempo':r.motivoDestiempo||'',
      'Reportado a Coordinador':r.reportadoCoordinador||'',
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
  [['fSupervisor','— Seleccionar supervisor —'],['pSupervisor','— Seleccionar —'],['pFiltSup','Todos los supervisores']].forEach(([id,first]) => {
    const el = document.getElementById(id);
    if(!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${first}</option>` + (id==='pFiltSup'
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
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;background:${s.estado==='activo'?'var(--azul-bg)':'#f5f5f5'};border:1px solid var(--gris-border);border-radius:8px;margin-bottom:6px;${s.estado!=='activo'?'opacity:.55;':''}">
      <div>
        <div style="font-weight:700;font-size:12px;">${esc(s.nombre)}</div>
        <div style="font-size:10px;color:var(--gris-text);">${esc(s.sector)} ${s.estado!=='activo'?'· <span style="color:var(--rojo);font-weight:700;">INACTIVO</span>':''}</div>
      </div>
      <div style="display:flex;gap:5px;">
        ${s.estado==='activo'
          ? `<button class="btn btn-danger btn-sm" onclick="toggleSup('${s.id}','inactivo')" title="Desactivar">⛔</button>`
          : `<button class="btn btn-success btn-sm" onclick="toggleSup('${s.id}','activo')" title="Reactivar">✅</button>`}
        ${esAdmin?`<button class="btn btn-danger btn-sm" onclick="eliminarSup('${s.id}')" title="Eliminar">🗑</button>`:''}
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
    renderProgramaciones();
    renderDashboard(); // refresca alertas y KPIs
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
    showToast(`📅 Programado: ${diasDesignados} día(s) designado(s) para el sector`);
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
  if(p.estado === 'ejecutada') return {key:'ejecutada', label:'✅ Ejecutada', badge:'badge-verde', dias:0};
  const {ini, fin, dias} = rangoProg(p);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fIni = new Date(ini + 'T12:00:00'); fIni.setHours(0,0,0,0);
  const fFin = new Date(fin + 'T12:00:00'); fFin.setHours(0,0,0,0);

  // Hoy dentro del rango designado → EN CURSO (o "Para hoy" si es 1 solo día)
  if(hoy >= fIni && hoy <= fFin) {
    if(fIni.getTime() === fFin.getTime()) return {key:'hoy', label:'📍 Para HOY', badge:'badge-amarillo', dias:0};
    const hoyStr = formatDate(hoy);
    const fechasP = fechasDeProg(p);
    const diaActual = Math.max(1, fechasP.filter(f => f <= hoyStr).length);
    return {key:'curso', label:`🟠 En Curso (día ${diaActual} de ${dias})`, badge:'badge-naranja', dias:0, diaActual, diasTot:dias};
  }
  if(fIni > hoy) {
    const diasCal = Math.round((fIni - hoy) / 86400000);
    return {key:'proxima', label:'🔵 Próxima', badge:'badge-azul', dias:diasCal};
  }
  // Vencida: días hábiles de atraso DESDE EL ÚLTIMO DÍA designado
  const dr = contarDiasHabiles(fFin, hoy);
  return {key:'vencida', label:'🚨 Vencida', badge:'badge-rojo', dias:dr};
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
        ${p.estado!=='ejecutada' ? `<button class="btn btn-success btn-sm" onclick="ejecutarProg('${p.id}')" title="Registrar ejecución">▶</button>` : ''}
        ${p.estado!=='ejecutada' ? `<button class="btn btn-secondary btn-sm" onclick="abrirReprog('${p.id}')" title="Editar / Reprogramar fechas">✏️</button>` : ''}
        ${esAdmin || p.estado!=='ejecutada' ? `<button class="btn btn-danger btn-sm" onclick="eliminarProg('${p.id}')" title="Eliminar">🗑</button>` : ''}
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
      'Estado': e.label.replace(/^[^\s]+\s/,''),
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
    html += `<div class="alert-card alert-rojo"><span class="alert-icon">🚨</span><div><strong>INCUMPLIMIENTO — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} programada ${fechasTxt} — <strong>${p._est.dias} día(s) hábil(es) de atraso</strong></div></div>`;
  });
  enCurso.forEach(p => {
    const rg = rangoProg(p);
    html += `<div class="alert-card alert-amarillo"><span class="alert-icon">🟠</span><div><strong>EN CURSO — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} — <strong>día ${p._est.diaActual} de ${p._est.diasTot} designados</strong> (${formatDateDisplay(rg.ini)} al ${formatDateDisplay(rg.fin)}). Al terminar el último día, registra la ejecución.</div></div>`;
  });
  paraHoy.forEach(p => {
    html += `<div class="alert-card alert-amarillo"><span class="alert-icon">📍</span><div><strong>HOY — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} programada para <strong>hoy</strong>. No olvides ejecutarla y registrarla.</div></div>`;
  });
  proximas.slice(0,4).forEach(p => {
    html += `<div class="alert-card alert-azul"><span class="alert-icon">🔜</span><div><strong>Próxima — ${esc(p.supervisor)}</strong> · ${esc(p.sector||'')}<br>${esc(p.tema)} el <strong>${formatDateDisplay(p.fechaProgramada)}</strong> (en ${p._est.dias} día(s))</div></div>`;
  });
  if(vencidas.length) {
    html += `<div style="margin-top:8px;"><button class="btn btn-pdf btn-sm" onclick="document.getElementById('btnIncumplPdf').click()">📄 Generar Informe de Incumplimientos</button></div>`;
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
    html += `<div class="cal-dia ${esHoy?'hoy':''} ${!habil?'no-habil':''}"><div class="cal-dia-num">${d}${esHoy?' 📍':''}</div>${chips}</div>`;
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
      return `<div class="alert-card alert-naranja" style="background:var(--naranja-light);border-left:4px solid var(--naranja);">
        <span class="alert-icon">🔄</span>
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
