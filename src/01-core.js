// ════════════════════════════════════════════════
//  SISTEMA ETI v6.0 — VERFRUT · RAPEL
//  Capacitaciones de Ética e Integridad
//  Firebase Firestore · Chart.js · SheetJS · jsPDF
//  v6: diseño corporativo, alertas de vencimiento,
//      módulo de supervisores y sincronización Sheets
// ════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { instalarPresenciaChat } from './js/presencia-chat.js?v=1';
import { instalarAlertasPendientes } from './js/alertas-pendientes.js?v=1';
import { instalarCierreHorario } from './js/cierre-horario.js?v=1';
import { instalarEstadisticas } from './js/estadisticas.js?v=3';
import { getFirestore, collection, addDoc as _fsAddDoc, getDocs, deleteDoc as _fsDeleteDoc, doc, updateDoc as _fsUpdateDoc, deleteField, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
/* _PROGRESO_ETI_V1 (02-oct-2026): circulo "Guardando… / Actualizando… / Eliminando…" y ✓ (progreso.js del Sistema RR.LL.).
   Las escrituras de 2do plano (migrar contraseña al entrar, marcar programacion ejecutada) usan _fs* directo: sin circulo. */
const _prog = (t, fn) => (window.RLProgreso && window.RLProgreso.accion) ? window.RLProgreso.accion(t, fn) : fn();
const _T = k => (window.RLProgreso && window.RLProgreso.T && window.RLProgreso.T[k]) || ['…', '✓'];
const addDoc = (...a) => _prog(_T('guardar'), () => _fsAddDoc(...a));
const updateDoc = (...a) => _prog(_T('actualizar'), () => _fsUpdateDoc(...a));
const deleteDoc = (...a) => _prog(_T('eliminar'), () => _fsDeleteDoc(...a));

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
const URL_SISTEMA_RRLL = 'https://sistemarrll.com/sistema-rl-verfrut/index.html';

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
// SEGURIDAD: las contraseñas NO se guardan en texto plano. "ph" es la huella
// SHA-256 de (usuario|contraseña|sal); no se puede recuperar la clave desde ella.
const ETI_SALT = 'ETI-VERFRUT-2026';
async function etiHash(user, pwd) {
  const data = new TextEncoder().encode(String(user) + '|' + String(pwd) + '|' + ETI_SALT);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const USUARIOS = [
  { usuario:'jtimoteo',  nombre:'Joel A. Timoteo Gonza',   ph:'4144313f138f53a9a7a81c5f855a70e754df61c61eb6a8c1d5bcf90b296ee068', rol:'admin'   },
  { usuario:'ovilela',   nombre:'Olga Vilela Ludeña',      ph:'a4058bf9d3a7e75eed5f35bd673969e4e022bb092e3f92340090594d18d31ea6', rol:'usuario' },
  { usuario:'jchavez',   nombre:'Jorge Chavez Cordova',    ph:'d7817f54685be778b1523c966ea6d47c3d1fa321a2a19130b163b99ac0cdbaee', rol:'usuario' },
  { usuario:'gcastillo', nombre:'Lucia Castillo Gonzalez', ph:'2f699f266bd2b7a16460622e28c55a63a1e48f2c8071d7f2e8622a5ff0692e03', rol:'usuario' },
  { usuario:'lcastillo', nombre:'L. Castillo',             ph:'52c593614509a45cae2ebbeaa3a1b5c3f53efbac7eb2c8074fbaac9acab3bfbb', rol:'usuario' },
  { usuario:'tmendoza',  nombre:'T. Mendoza',              ph:'70b22897ebab5a7c25f9aff0d0d5175bd80adde36b44df6ac914d076900950e4', rol:'usuario' }
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
// ═══ _ETI_MODULAR_V1 (25-oct-2026): modulos en js/ (presencia/chat, alertas, cierre por horario, estadisticas) ═══
// Leen el estado compartido SOLO a traves de este puente (getters: siempre el valor actual).
const _CTX = {
  get usuarioActual() { return usuarioActual; }, get usuariosCuentas() { return usuariosCuentas; }, get supervisores() { return supervisores; },
  get registros() { return registros; }, get USUARIOS() { return USUARIOS; }, get ESTADO_META() { return ESTADO_META; },
  esc: (...a) => esc(...a), showToast: (...a) => showToast(...a), cerrarSesion: (...a) => cerrarSesion(...a),
  calcularEstado: (...a) => calcularEstado(...a), contarDiasHabiles: (...a) => contarDiasHabiles(...a),
  formatDate: (...a) => formatDate(...a), formatDateDisplay: (...a) => formatDateDisplay(...a), setText: (...a) => setText(...a)
};
const { rlPresenciaIniciar, rlPresenciaDetener } = instalarPresenciaChat(_CTX);
instalarAlertasPendientes(_CTX);
instalarCierreHorario(_CTX);
const { exportarExcel, renderRanking, exportRankingPDF, renderEstadisticas, exportStatsPDF } = instalarEstadisticas(_CTX);
