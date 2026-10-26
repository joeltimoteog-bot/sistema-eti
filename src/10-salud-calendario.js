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
      const temaCorto = p.tema==='CAPACITACIONES ETI'?'ETI':p.tema==='EVALUACIONES DE CHECKLIST'?'CHECKLIST':p.tema==='INGRESOS MASIVOS'?'INGRESOS':'REFORZ.';   /* _KPI_RRLL_V1 */
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
