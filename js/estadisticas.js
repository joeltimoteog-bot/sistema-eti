/* Sistema ETI Capacitaciones · Excel, ranking y estadisticas
   Extraido de script.js el 25-oct-2026 (_ETI_MODULAR_V1) SIN cambios de logica: lee el estado compartido
   a traves de C (registros, ESTADO_META, calcularEstado, contarDiasHabiles, formatDate*, setText, esc, showToast). */
export function instalarEstadisticas(C) {
  let stEstados=null, stTemas=null, stSupervisores=null, stTrabajadores=null, stMensual=null, stTemporada=null;
// ─── EXCEL ────────────────────────────────────────────────────
function exportarExcel() {
  if(!C.registros.length){C.showToast('Sin datos para exportar',true);return;}
  const data=C.registros.map(r=>{
    const est=C.calcularEstado(r);
    return{
      'Supervisor':r.supervisor,'Sector':r.sector||'','Tema':r.tema,
      'Tipo Personal':r.tipoPersonal||'','Varones':r.varones||0,'Mujeres':r.mujeres||0,'Total':r.total||0,
      'Fecha Ejecución':r.fechaEjecucion,'Fecha Límite':r.fechaLimite,'Fecha Envío':r.fechaEnvio||'PENDIENTE',
      'Temporada':r.temporada,'Estado':C.ESTADO_META[est.estado].label,
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
  XLSX.writeFile(wb,`ETI_Registros_${C.formatDate(new Date())}.xlsx`);
  C.showToast('📥 Excel exportado.');
}

// ─── RANKING ──────────────────────────────────────────────────
function calcularRanking() {
  const conEstado=C.registros.map(r=>({...r,...calcularEstado(r)}));
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
    C.setText('rkMejor',mejor?mejor.nombre.split(' ').slice(0,2).join(' '):'–');
    C.setText('rkPeor',peor&&peor.cumplimiento<100?peor.nombre.split(' ').slice(0,2).join(' '):'–');
    const prom=conDatos.length?Math.round(conDatos.reduce((a,r)=>a+r.cumplimiento,0)/conDatos.length):0;
    C.setText('rkPromedio',prom+'%');
  }

  const div=document.getElementById('rankingLista');
  if(!ranking.length){div.innerHTML='<p class="empty-msg">Sin C.registros para rankear.</p>';return;}
  div.innerHTML=ranking.map((r,i)=>{
    const posClass=i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const posLabel=`${i+1}°`;
    const color=r.cumplimiento>=80?'#1a8040':r.cumplimiento>=50?'#c89010':'#cc0000';
    const fillClass=r.cumplimiento>=80?'pf-verde':r.cumplimiento>=50?'pf-amarillo':'pf-rojo';
    return `<div class="rank-item">
      <div class="rank-pos ${posClass}">${posLabel}</div>
      <div class="rank-info">
        <div class="rank-name">${C.esc(r.nombre)}</div>
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
  if(!ranking.length){C.showToast('Sin datos',true);return;}
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('l','mm','a4');
  pdf.setFontSize(15);pdf.setTextColor(0,26,94);
  pdf.text('RANKING DE SUPERVISORES — CAPACITACIONES ETI · VERFRUT',15,16);
  pdf.setFontSize(9);pdf.setTextColor(80,80,80);
  pdf.text(`Generado: ${C.formatDateDisplay(C.formatDate(new Date()))} · Sistema ETI v5.0`,15,23);
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
  pdf.save(`Ranking_ETI_${C.formatDate(new Date())}.pdf`);
  C.showToast('📄 PDF descargado.');
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────
function poblarAnios() {
  const anios=[...new Set(C.registros.map(r=>new Date(r.fechaEjecucion+'T12:00:00').getFullYear()))].sort((a,b)=>b-a);
  const sel=document.getElementById('statAnio');
  const cur=sel.value;
  sel.innerHTML='<option value="">Todos los años</option>'+anios.map(a=>`<option value="${a}">${a}</option>`).join('');
  if(cur&&anios.includes(parseInt(cur)))sel.value=cur;
}

function renderEstadisticas() {
  poblarAnios();
  const anio=document.getElementById('statAnio').value;
  let data=C.registros.map(r=>({...r,...calcularEstado(r)}));
  if(anio)data=data.filter(r=>new Date(r.fechaEjecucion+'T12:00:00').getFullYear()===parseInt(anio));

  const cumplidos=data.filter(r=>r.estado==='cumplido').length;
  const retrasos=data.filter(r=>r.estado==='leve'||r.estado==='critico').length;
  const fin=cumplidos+retrasos;
  const totalTrab=data.reduce((a,r)=>a+(r.total||0),0);

  // Días promedio de envío
  const conEnvio=data.filter(r=>r.fechaEnvio);
  const diasProm=conEnvio.length?(conEnvio.reduce((a,r)=>{
    return a+C.contarDiasHabiles(new Date(r.fechaEjecucion+'T12:00:00'),new Date(r.fechaEnvio+'T12:00:00'));
  },0)/conEnvio.length).toFixed(1):0;

  // Meses activos para promedio
  const mesesActivos=new Set(data.map(r=>{const d=new Date(r.fechaEjecucion+'T12:00:00');return d.getFullYear()*100+d.getMonth();})).size;

  C.setText('sTotal',data.length);
  C.setText('sTrabajadores',totalTrab.toLocaleString());
  C.setText('sCumplimiento',(fin?Math.round((cumplidos/fin)*100):0)+'%');
  C.setText('sPromedio',mesesActivos?Math.round(data.length/mesesActivos*10)/10:0);
  C.setText('sRetrasos',retrasos);
  C.setText('sDiasProm',diasProm);

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
  let data=C.registros.map(r=>({...r,...calcularEstado(r)}));
  if(anio)data=data.filter(r=>new Date(r.fechaEjecucion+'T12:00:00').getFullYear()===parseInt(anio));
  if(!data.length){C.showToast('Sin datos',true);return;}

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
  pdf.text(`Verfrut · Relaciones Laborales · ${anio||'Todos los años'} · Generado: ${C.formatDateDisplay(C.formatDate(new Date()))}`,15,25);
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
  if(!conRetraso.length){pdf.setTextColor(26,128,64);pdf.text('✓ Sin C.registros con retraso.',18,y);}
  else conRetraso.forEach(r=>{
    if(y>270){pdf.addPage();y=18;}
    pdf.setTextColor(150,20,20);
    pdf.text(`• ${r.supervisor} — ${r.tema} — Ejecución: ${r.fechaEjecucion} — ${r.diasRetraso} día(s) hábil(es) de retraso`,18,y);
    y+=6;
  });

  pdf.save(`Reporte_ETI_${anio||'completo'}_${C.formatDate(new Date())}.pdf`);
  C.showToast('📄 Reporte PDF descargado.');
}

  return { exportarExcel, calcularRanking, renderRanking, exportRankingPDF, poblarAnios, renderEstadisticas, renderChartsStats, exportStatsPDF };
}
