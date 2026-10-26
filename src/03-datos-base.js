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
