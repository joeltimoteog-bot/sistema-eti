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
      try { await _fsUpdateDoc(doc(db, COL_PROG, progId), {estado:'ejecutada', registroId:refDoc.id, ejecutadaEn:new Date().toISOString()}); }
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
