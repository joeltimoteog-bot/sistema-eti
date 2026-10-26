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
    await _prog(_T('eliminar'), async () => { for(const d of snap.docs) await _fsDeleteDoc(doc(db,COL,d.id)); });   /* _PROGRESO_ETI_V1: un solo circulo */
    showToast('🗑 Todos los registros fueron eliminados.');
  }catch(e){showToast('❌ Error.',true);}
}

// ─── EXCEL / RANKING / ESTADÍSTICAS: en js/estadisticas.js (_ETI_MODULAR_V1) ───
