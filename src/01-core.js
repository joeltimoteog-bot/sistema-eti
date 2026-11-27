// ════════════════════════════════════════════════
//  SISTEMA ETI v6.0 — VERFRUT · RAPEL
//  Capacitaciones de Ética e Integridad
//  Firebase Firestore · Chart.js · SheetJS · jsPDF
//  v6: diseño corporativo, alertas de vencimiento,
//      módulo de supervisores y sincronización Sheets
// ════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { instalarPresenciaChat } from './js/presencia-chat.js?v=1';
import { instalarAlertasPendientes } from './js/alertas-pendientes.js?v=2';
import { instalarCierreHorario } from './js/cierre-horario.js?v=2';
import { instalarEstadisticas } from './js/estadisticas.js?v=3';
/* _ETI_SUPABASE_V3 (15-nov-2026) — ETAPA 3: los datos de Capacitaciones ETI se leen y guardan en SUPABASE; Firestore queda como respaldo.
   Las mismas funciones de siempre, servidas por js/eti-fs-shim.js. Volver a Firestore sin publicar: localStorage.eti_motor = "firestore". */
import { getFirestore, collection, addDoc as _fsAddDoc, getDocs, deleteDoc as _fsDeleteDoc, doc, updateDoc as _fsUpdateDoc, deleteField, query, orderBy, onSnapshot } from "./js/eti-fs-shim.js?v=1";
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
// SEGURIDAD: las contraseñas NO se guardan en texto plano ni en este codigo. etiHash calcula la huella
// SHA-256 de (usuario|contraseña|sal) solo para las cuentas de Gestion de Usuarios.
const ETI_SALT = 'ETI-VERFRUT-2026';
async function etiHash(user, pwd) {
  const data = new TextEncoder().encode(String(user) + '|' + String(pwd) + '|' + ETI_SALT);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
/* _SIN_HUELLAS_V1 (10-nov-2026): esta lista ya NO lleva huellas de contraseña ni sirve para validar claves.
   Solo indica el ROL dentro de Capacitaciones ETI (administrador / equipo) de quien ya fue validado por el SERVIDOR
   (pase del Sistema RR.LL. o login comun). Se retiraron las cuentas de quienes ya no pertenecen al area.
   etiHash queda solo para las cuentas de supervisores de Gestion de Usuarios (src/14-usuarios.js). */
const USUARIOS = [
  { usuario:'jtimoteo',  nombre:'Joel A. Timoteo Gonza', rol:'admin'   },
  { usuario:'gcastillo', nombre:'Lucia Castillo Gonzalez', rol:'usuario' },
  { usuario:'lcastillo', nombre:'L. Castillo', rol:'usuario' },
  { usuario:'tmendoza',  nombre:'T. Mendoza', rol:'usuario' }
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
