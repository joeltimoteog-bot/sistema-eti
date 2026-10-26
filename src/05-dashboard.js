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
