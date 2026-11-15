/* ═══════════════════════════════════════════════════════════════════════════
   eti-fs-shim.js — _ETI_SUPABASE_V3 (15-nov-2026) — ETAPA 3: SUPABASE MANDA (Capacitaciones ETI)
   Reemplaza las funciones de Firestore que usa script.js (collection, doc, addDoc, getDocs, updateDoc, deleteDoc,
   deleteField, query, orderBy, onSnapshot, getFirestore) por versiones que LEEN y ESCRIBEN en Supabase
   (tablas eti.<coleccion>, mismas rutas /api/eti/consultar|escribir que ya usa Evaluacion ETI).
   Firestore queda como RESPALDO: cada escritura se copia tambien a Firestore en segundo plano (no bloquea,
   no muestra errores). Las escuchas en vivo (onSnapshot) se emulan consultando Supabase cada POLL_MS y
   al instante despues de cada escritura propia.
   Volver atras en 1 segundo (sin publicar nada):  localStorage.eti_motor = 'firestore'  y recargar.
   Si no hay sesion (token del RR.LL.) todavia, se usa Firestore como antes.
   Herramientas (F12):  etiMotor.estado()  etiMotor.copiarAFirestore()  etiMotor.verificar()
   ═══════════════════════════════════════════════════════════════════════════ */
import * as FS from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/eti/';
const POLL_MS = 12000;
const COLS = ['capacitaciones', 'programaciones_eti', 'supervisores_eti', 'usuarios_eti'];
let MOTOR = 'supabase'; try { if (localStorage.getItem('eti_motor') === 'firestore') MOTOR = 'firestore'; } catch (e) {}
const est = { motor: MOTOR, lecturas: 0, escrituras: 0, respaldos: 0, erroresRespaldo: 0, firestoreSinToken: 0, ultimoError: '' };
const token = () => { try { return sessionStorage.getItem('eti_rl_token') || ''; } catch (e) { return ''; } };
const usaSupabase = (col) => MOTOR === 'supabase' && COLS.indexOf(col) >= 0 && !!token() && navigator.onLine;
let realDb = null;   /* Firestore real: respaldo y camino de retorno */

/* ── transporte ── */
async function post(accion, cuerpo) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(API + accion + '?forceFunctionRegion=sa-east-1', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(cuerpo || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) { const e = new Error(j.error || j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
const limpio = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toDate === 'function') ? x.toDate().toISOString() : x));
const BORRAR = Symbol.for('eti.deleteField');
function idNuevo() { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; const r = new Uint8Array(20); crypto.getRandomValues(r); for (let i = 0; i < 20; i++) s += A[r[i] % 62]; return s; }

/* ── referencias (objetos propios; si el motor es Firestore se usan los reales) ── */
export function getFirestore(app) { realDb = FS.getFirestore(app); return MOTOR === 'firestore' ? realDb : { __shim: true, app }; }
export function collection(db, name) { return (db && db.__shim) ? { __t: 'col', col: name } : FS.collection(db, name); }
export function doc(db, col, id) {
  if (db && db.__shim) return { __t: 'doc', col, id: id || idNuevo() };
  if (db && db.__t === 'col') return { __t: 'doc', col: db.col, id: col || idNuevo() };
  return FS.doc(db, col, id);
}
export function query(ref, ...cs) { if (!(ref && ref.__t)) return FS.query(ref, ...cs); const q = { __t: 'query', col: ref.col, orden: null, filtros: [], limite: 0 }; cs.forEach(c => { if (!c) return; if (c.__t === 'orderBy') q.orden = [c.f, c.dir]; else if (c.__t === 'where') q.filtros.push([c.f, c.op, c.v]); else if (c.__t === 'limit') q.limite = c.n; }); return q; }
export function orderBy(f, dir) { return MOTOR === 'firestore' ? FS.orderBy(f, dir) : { __t: 'orderBy', f, dir: dir === 'desc' ? 'desc' : 'asc' }; }
export function where(f, op, v) { return MOTOR === 'firestore' ? FS.where(f, op, v) : { __t: 'where', f, op, v }; }
export function limit(n) { return MOTOR === 'firestore' ? FS.limit(n) : { __t: 'limit', n }; }
export function deleteField() { return MOTOR === 'firestore' ? FS.deleteField() : BORRAR; }
export const serverTimestamp = () => MOTOR === 'firestore' ? FS.serverTimestamp() : new Date().toISOString();

/* ── snapshots compatibles con lo que usa script.js (docs, empty, size, forEach, d.id, d.data(), d.ref) ── */
function snapDe(col, filas) {
  const docs = filas.map(r => ({ id: r.id, ref: { __t: 'doc', col, id: r.id }, exists: () => true, data: () => r.datos || {} }));
  return { docs, empty: !docs.length, size: docs.length, forEach: (fn) => docs.forEach(fn), metadata: { fromCache: false, hasPendingWrites: false, fuente: 'supabase' } };
}
const cmp = (a, b) => { const ra = a == null ? 0 : typeof a === 'boolean' ? 1 : typeof a === 'number' ? 2 : 3, rb = b == null ? 0 : typeof b === 'boolean' ? 1 : typeof b === 'number' ? 2 : 3; if (ra !== rb) return ra - rb; return a < b ? -1 : a > b ? 1 : 0; };
function ordenar(q, filas) { if (!q.orden) return filas; const [f, dir] = q.orden, g = (o) => f.split('.').reduce((x, k) => x == null ? undefined : x[k], o.datos || {}); filas.sort((a, b) => cmp(g(a), g(b)) * (dir === 'desc' ? -1 : 1)); return filas; }
async function consultar(q) {
  const j = await post('consultar', { col: q.col, filtros: q.filtros || [], orden: q.orden, limite: q.limite || 20000 });
  est.lecturas++; return snapDe(q.col, ordenar(q, j.docs || []));
}

/* ── respaldo a Firestore (segundo plano, nunca bloquea) ── */
const colaRespaldo = [];
async function respaldar(op) {
  if (!realDb) return;
  try {
    if (op.op === 'delete') await FS.deleteDoc(FS.doc(realDb, op.col, op.id));
    else if (op.op === 'set') await FS.setDoc(FS.doc(realDb, op.col, op.id), op.datos, { merge: !!op.merge });
    else { const d = Object.assign({}, op.datos); (op.borrar || []).forEach(k => { d[k] = FS.deleteField(); }); await FS.setDoc(FS.doc(realDb, op.col, op.id), d, { merge: true }); }
    est.respaldos++;
  } catch (e) { est.erroresRespaldo++; est.ultimoError = 'respaldo: ' + (e && e.message); colaRespaldo.push(op); if (colaRespaldo.length > 500) colaRespaldo.shift(); }
}
setInterval(() => { if (!colaRespaldo.length || !navigator.onLine) return; const op = colaRespaldo.shift(); respaldar(op); }, 15000);

/* ── escrituras: Supabase primero (si falla, el usuario ve el error); luego copia a Firestore ── */
const oyentes = {};   /* col -> Set de funciones que refrescan onSnapshot */
function avisar(col) { (oyentes[col] || new Set()).forEach(fn => { try { fn(); } catch (e) {} }); }
async function escribir(op) {
  await post('escribir', { ops: [Object.assign({ origen: 'capacitaciones' }, op)] });
  est.escrituras++; avisar(op.col); respaldar(op);
}
function separarBorrados(datos) { const d = {}, borrar = []; Object.keys(datos || {}).forEach(k => { if (datos[k] === BORRAR) borrar.push(k); else if (datos[k] !== undefined) d[k] = datos[k]; }); return { datos: limpio(d), borrar }; }
export async function addDoc(colRef, datos) {
  if (!(colRef && colRef.__t)) return FS.addDoc(colRef, datos);
  if (!usaSupabase(colRef.col)) { est.firestoreSinToken++; const r = await FS.addDoc(FS.collection(realDb, colRef.col), datos); return r; }
  const id = idNuevo(); await escribir({ col: colRef.col, id, op: 'set', datos: limpio(datos) });
  return { __t: 'doc', col: colRef.col, id };
}
export async function setDoc(ref, datos, opc) {
  if (!(ref && ref.__t)) return FS.setDoc(ref, datos, opc);
  if (!usaSupabase(ref.col)) { est.firestoreSinToken++; return FS.setDoc(FS.doc(realDb, ref.col, ref.id), datos, opc); }
  await escribir({ col: ref.col, id: ref.id, op: 'set', datos: limpio(datos), merge: !!(opc && opc.merge) });
}
export async function updateDoc(ref, datos) {
  if (!(ref && ref.__t)) return FS.updateDoc(ref, datos);
  if (!usaSupabase(ref.col)) { est.firestoreSinToken++; return FS.updateDoc(FS.doc(realDb, ref.col, ref.id), datos); }
  const s = separarBorrados(datos); await escribir({ col: ref.col, id: ref.id, op: 'update', datos: s.datos, borrar: s.borrar });
}
export async function deleteDoc(ref) {
  if (!(ref && ref.__t)) return FS.deleteDoc(ref);
  if (!usaSupabase(ref.col)) { est.firestoreSinToken++; return FS.deleteDoc(FS.doc(realDb, ref.col, ref.id)); }
  await escribir({ col: ref.col, id: ref.id, op: 'delete' });
}

/* ── lecturas ── */
function aFsQuery(q) { const cs = []; (q.filtros || []).forEach(f => cs.push(FS.where(f[0], f[1], f[2]))); if (q.orden) cs.push(FS.orderBy(q.orden[0], q.orden[1])); if (q.limite) cs.push(FS.limit(q.limite)); return FS.query(FS.collection(realDb, q.col), ...cs); }
const normQ = (q) => q.__t === 'col' ? { __t: 'query', col: q.col, orden: null, filtros: [], limite: 0 } : q;
export async function getDocs(q) {
  if (!(q && q.__t)) return FS.getDocs(q);
  q = normQ(q);
  if (!usaSupabase(q.col)) { est.firestoreSinToken++; return FS.getDocs(aFsQuery(q)); }
  try { return await consultar(q); }
  catch (e) { est.ultimoError = 'lectura: ' + (e && e.message); console.warn('[eti-motor] Supabase: ' + (e && e.message) + ' → se lee de Firestore (respaldo)'); return FS.getDocs(aFsQuery(q)); }   /* 401/403 (p. ej. usuarios_eti solo para gestores) tambien caen al respaldo, como antes de la etapa 3 */
}
export async function getDoc(ref) {
  if (!(ref && ref.__t)) return FS.getDoc(ref);
  if (!usaSupabase(ref.col)) { est.firestoreSinToken++; return FS.getDoc(FS.doc(realDb, ref.col, ref.id)); }
  const j = await post('doc', { col: ref.col, id: ref.id }); est.lecturas++;
  return { id: ref.id, ref, exists: () => !!j.existe, data: () => j.existe ? j.datos : undefined };
}
export function onSnapshot(q, cb, errCb) {
  if (!(q && q.__t)) return FS.onSnapshot(q, cb, errCb);
  q = normQ(q);
  if (!usaSupabase(q.col)) { est.firestoreSinToken++; return FS.onSnapshot(aFsQuery(q), cb, errCb); }
  let vivo = true, huella = null, enVuelo = false, unsubFs = null, iv = null;
  const tick = async () => {
    if (!vivo || enVuelo || document.hidden && huella !== null) return; enVuelo = true;
    try { const s = await consultar(q); const h = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (h !== huella) { huella = h; cb(s); } }
    catch (e) { est.ultimoError = 'escucha: ' + (e && e.message); if (huella === null) { /* primera lectura fallida: escucha de Firestore como antes */ vivo = false; clearInterval(iv); try { unsubFs = FS.onSnapshot(aFsQuery(q), cb, errCb); } catch (e2) { if (errCb) errCb(e); } } }
    finally { enVuelo = false; }
  };
  iv = setInterval(tick, POLL_MS); tick();
  const vis = () => { if (!document.hidden) tick(); }; document.addEventListener('visibilitychange', vis);
  (oyentes[q.col] = oyentes[q.col] || new Set()).add(tick);
  return () => { vivo = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis); oyentes[q.col].delete(tick); if (unsubFs) unsubFs(); };
}

/* ── herramientas del administrador ── */
window.etiMotor = {
  estado: () => { const e = Object.assign({}, est, { token: !!token(), enColaRespaldo: colaRespaldo.length }); console.log(e); return e; },
  /* compara Supabase vs Firestore (documento por documento) */
  verificar: async (cols) => {
    const res = {};
    for (const c of (cols || COLS)) {
      const sb = (await post('consultar', { col: c, limite: 20000 })).docs, fs = await FS.getDocs(FS.collection(realDb, c));
      const m = {}; sb.forEach(d => { m[d.id] = JSON.stringify(canon(d.datos)); });
      let faltanEnSb = 0, distintos = 0, faltanEnFs = 0; const enFs = {};
      fs.docs.forEach(d => { enFs[d.id] = 1; const x = m[d.id]; if (x === undefined) faltanEnSb++; else if (x !== JSON.stringify(canon(limpio(d.data())))) distintos++; });
      sb.forEach(d => { if (!enFs[d.id]) faltanEnFs++; });
      res[c] = { supabase: sb.length, firestore: fs.size, faltanEnSupabase: faltanEnSb, faltanEnFirestore: faltanEnFs, distintos };
    }
    console.table(res); return res;
  },
  /* copia Firestore -> Supabase (para la migracion inicial; solo administrador) */
  copiarASupabase: async (cols) => {
    const res = {};
    for (const c of (cols || COLS)) {
      const fs = await FS.getDocs(FS.collection(realDb, c)), docs = fs.docs.map(d => ({ id: d.id, datos: limpio(d.data()) }));
      let n = 0; for (let i = 0; i < docs.length; i += 300) { const j = await post('importar', { col: c, docs: docs.slice(i, i + 300) }); n += j.importados || 0; }
      res[c] = docs.length + ' en Firestore -> ' + n + ' copiados'; console.log('[Firestore -> Supabase] ' + c + ': ' + res[c]);
    }
    console.table(res); return res;
  },
  /* copia Supabase -> Firestore (mantener el respaldo al dia) */
  copiarAFirestore: async (cols) => {
    const res = {};
    for (const c of (cols || COLS)) { const sb = (await post('consultar', { col: c, limite: 20000 })).docs; let n = 0; for (const d of sb) { await FS.setDoc(FS.doc(realDb, c, d.id), d.datos); n++; } res[c] = n; }
    console.table(res); return res;
  }
};
function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { o[k] = canon(v[k]); }); return o; } return v; }
console.log('[eti-motor] Capacitaciones ETI: motor de datos = ' + MOTOR + (MOTOR === 'supabase' ? ' (Firestore como respaldo)' : ''));
