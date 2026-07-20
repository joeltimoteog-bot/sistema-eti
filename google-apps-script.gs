/**
 * ════════════════════════════════════════════════════════════════
 *  SISTEMA ETI v6.0 — SINCRONIZACIÓN CON GOOGLE SHEETS + ALERTAS
 *  Verfrut · RAPEL · Relaciones Laborales
 *
 *  Este script se instala en Google Apps Script (script.google.com)
 *  vinculado a una hoja de Google Sheets, y hace dos cosas:
 *
 *  1) SINCRONIZAR: cada hora copia TODOS los datos del sistema
 *     (capacitaciones, programaciones, supervisores y cuentas)
 *     desde Firebase a la hoja de cálculo. La hoja siempre queda
 *     como respaldo/base de datos actualizada.
 *
 *  2) ALERTAR: todos los días a las 7 a.m. envía un correo con las
 *     programaciones próximas a vencer (3, 2, 1 días), las de hoy,
 *     las vencidas y las actas con retraso.
 *
 *  INSTALACIÓN: ver el archivo GUIA_GOOGLE_SHEETS.md
 * ════════════════════════════════════════════════════════════════
 */

// ─────────────────── CONFIGURACIÓN ───────────────────
const CONFIG = {
  // Proyecto de Firebase del sistema (no cambiar)
  PROJECT_ID: 'sistema-eti-verfrut',
  API_KEY: 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc',

  // Correos que recibirán las alertas diarias (separados por coma)
  DESTINATARIOS: 'joel.timoteog@gmail.com',

  // Hora del correo diario (0-23, hora de Perú)
  HORA_CORREO: 7,

  // Días de anticipación para avisar de programaciones próximas
  DIAS_ANTICIPACION: 3
};

// ═══════════════ 1. LECTURA DESDE FIREBASE ═══════════════

function firestoreUrl_(coleccion, pageToken) {
  let url = 'https://firestore.googleapis.com/v1/projects/' + CONFIG.PROJECT_ID +
    '/databases/(default)/documents/' + coleccion + '?pageSize=300&key=' + CONFIG.API_KEY;
  if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
  return url;
}

/** Convierte un valor de Firestore REST a valor plano de JS */
function parseValor_(v) {
  if (v == null) return '';
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return '';
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValor_);
  if ('mapValue' in v) {
    const out = {};
    const f = v.mapValue.fields || {};
    Object.keys(f).forEach(k => out[k] = parseValor_(f[k]));
    return out;
  }
  return '';
}

/** Descarga una colección completa de Firestore como lista de objetos */
function leerColeccion_(coleccion) {
  const docs = [];
  let pageToken = null;
  do {
    const resp = UrlFetchApp.fetch(firestoreUrl_(coleccion, pageToken), {muteHttpExceptions: true});
    if (resp.getResponseCode() !== 200) {
      throw new Error('Error leyendo ' + coleccion + ': ' + resp.getContentText().substring(0, 300));
    }
    const data = JSON.parse(resp.getContentText());
    (data.documents || []).forEach(d => {
      const obj = {};
      const fields = d.fields || {};
      Object.keys(fields).forEach(k => obj[k] = parseValor_(fields[k]));
      obj._id = d.name.split('/').pop();
      docs.push(obj);
    });
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

// ═══════════════ 2. UTILIDADES DE FECHAS ═══════════════

function hoyStr_() {
  return Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
}

function fmt_(iso) {
  if (!iso) return '';
  const p = String(iso).substring(0, 10).split('-');
  if (p.length !== 3) return iso;
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return p[2] + '/' + meses[Number(p[1]) - 1] + '/' + p[0];
}

function diasEntre_(desdeStr, hastaStr) {
  const d1 = new Date(desdeStr + 'T12:00:00');
  const d2 = new Date(hastaStr + 'T12:00:00');
  return Math.round((d2 - d1) / 86400000);
}

/** Fechas designadas de una programación (compatible con las antiguas) */
function fechasDeProg_(p) {
  if (p.fechas && p.fechas.length) return p.fechas.slice().sort();
  const ini = p.fechaProgramada, fin = p.fechaFin || p.fechaProgramada;
  return ini ? [ini, fin].filter((v, i, a) => a.indexOf(v) === i).sort() : [];
}

// ═══════════════ 3. SINCRONIZACIÓN A SHEETS ═══════════════

/** ► EJECUTAR PARA SINCRONIZAR TODO MANUALMENTE */
function sincronizarTodo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoy = hoyStr_();

  // ---- CAPACITACIONES ----
  const caps = leerColeccion_('capacitaciones');
  caps.sort((a, b) => String(b.fechaEjecucion).localeCompare(String(a.fechaEjecucion)));
  escribirHoja_(ss, 'Capacitaciones', [
    'ID', 'Supervisor', 'Sector', 'Tema', 'Tipo Personal', 'Varones', 'Mujeres', 'Total',
    'Fecha Ejecución', 'Fecha Límite', 'Fecha Envío Actas', 'Estado', 'Temporada',
    'Rutas', 'Áreas', 'Códigos Capacitados', 'N° Códigos', 'Observaciones', 'Registrado Por', 'Creado En'
  ], caps.map(r => {
    let estado;
    if (r.fechaEnvio) estado = (r.fechaEnvio <= r.fechaLimite) ? 'CUMPLIDO' : 'ENVIADO CON RETRASO';
    else estado = (hoy <= r.fechaLimite) ? 'EN PROCESO' : 'RETRASADO (sin envío)';
    const rutas = r.rutasTipo === 'varias' ? 'VARIAS' :
      (r.rutasTexto || (Array.isArray(r.rutas) ? r.rutas.map(x => (x.codigo || '') + ' ' + (x.nombre || '')).join('; ') : ''));
    const areas = Array.isArray(r.areas) ? r.areas.map(x => (x.nombre || '') + ': ' + (x.cantidad || 0)).join('; ') : '';
    const cods = Array.isArray(r.codigosCapacitados) ? r.codigosCapacitados : [];
    return [
      r._id, r.supervisor || '', r.sector || '', r.tema || '', r.tipoPersonal || '',
      r.varones || 0, r.mujeres || 0, r.total || 0,
      r.fechaEjecucion || '', r.fechaLimite || '', r.fechaEnvio || '', estado, r.temporada || '',
      rutas, areas, cods.join(', '), cods.length, r.observaciones || '', r.registradoPor || '', r.creadoEn || ''
    ];
  }));

  // ---- PROGRAMACIONES ----
  const progs = leerColeccion_('programaciones_eti');
  progs.sort((a, b) => String(a.fechaProgramada).localeCompare(String(b.fechaProgramada)));
  escribirHoja_(ss, 'Programaciones', [
    'ID', 'Supervisor', 'Sector', 'Tema', 'Fecha Inicio', 'Fecha Fin', 'Fechas Designadas',
    'Días Designados', 'Estado', 'Días para vencer / de atraso', 'Veces Reprogramada',
    'Motivos de Reprogramación', 'Observaciones', 'Programado Por', 'Creado En'
  ], progs.map(p => {
    const fechas = fechasDeProg_(p);
    const fin = fechas[fechas.length - 1] || '';
    let estado, dias = '';
    if (p.estado === 'ejecutada') estado = 'EJECUTADA';
    else if (!fin) estado = 'SIN FECHA';
    else if (fin < hoy) { estado = 'VENCIDA'; dias = diasEntre_(fin, hoy) + ' día(s) de atraso'; }
    else if (fechas[0] <= hoy) estado = 'EN CURSO / HOY';
    else { estado = 'PENDIENTE'; dias = 'faltan ' + diasEntre_(hoy, fechas[0]) + ' día(s)'; }
    return [
      p._id, p.supervisor || '', p.sector || '', p.tema || '',
      p.fechaProgramada || '', p.fechaFin || p.fechaProgramada || '', fechas.join(', '),
      fechas.length, estado, dias, p.vecesReprogramada || 0,
      Array.isArray(p.reprogramaciones) ? p.reprogramaciones.map(r => r.motivo || '').join('; ') : '',
      p.observaciones || '', p.creadoPor || '', p.creadoEn || ''
    ];
  }));

  // ---- SUPERVISORES ----
  const sups = leerColeccion_('supervisores_eti');
  sups.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
  escribirHoja_(ss, 'Supervisores', ['ID', 'Nombre', 'Sector', 'Estado', 'Creado En'],
    sups.map(s => [s._id, s.nombre || '', s.sector || '', s.estado || 'activo', s.creadoEn || '']));

  // ---- CUENTAS DE USUARIOS ----
  const users = leerColeccion_('usuarios_eti');
  escribirHoja_(ss, 'Cuentas Supervisores', ['ID', 'Supervisor', 'Usuario', 'Estado', 'Creada Por', 'Creado En'],
    users.map(u => [u._id, u.supervisorNombre || '', u.usuario || '', u.estado || 'activo', u.creadoPor || '', u.creadoEn || '']));

  // ---- Marca de última sincronización ----
  let meta = ss.getSheetByName('_Sync');
  if (!meta) meta = ss.insertSheet('_Sync');
  meta.getRange('A1:B1').setValues([['Última sincronización', Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm:ss')]]);

  Logger.log('Sincronización completa: %s capacitaciones, %s programaciones, %s supervisores, %s cuentas',
    caps.length, progs.length, sups.length, users.length);
}

function escribirHoja_(ss, nombre, cabeceras, filas) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  sh.clearContents();
  sh.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]).setFontWeight('bold').setBackground('#0A1633').setFontColor('#FFFFFF');
  if (filas.length) sh.getRange(2, 1, filas.length, cabeceras.length).setValues(filas);
  sh.setFrozenRows(1);
}

// ═══════════════ 4. CORREO DIARIO DE ALERTAS ═══════════════

/** ► EJECUTAR PARA ENVIAR EL CORREO DE ALERTAS MANUALMENTE */
function enviarAlertasDiarias() {
  const hoy = hoyStr_();
  const progs = leerColeccion_('programaciones_eti').filter(p => p.estado !== 'ejecutada');
  const caps = leerColeccion_('capacitaciones');

  const vencidas = [], deHoy = [], proximas = [];
  progs.forEach(p => {
    const fechas = fechasDeProg_(p);
    if (!fechas.length) return;
    const ini = fechas[0], fin = fechas[fechas.length - 1];
    if (fin < hoy) vencidas.push({p: p, dias: diasEntre_(fin, hoy)});
    else if (ini <= hoy) deHoy.push({p: p});
    else if (diasEntre_(hoy, ini) <= CONFIG.DIAS_ANTICIPACION) proximas.push({p: p, dias: diasEntre_(hoy, ini)});
  });

  const actasRetraso = caps.filter(r => !r.fechaEnvio && r.fechaLimite && r.fechaLimite < hoy);
  const actasPorVencer = caps.filter(r => !r.fechaEnvio && r.fechaLimite && r.fechaLimite >= hoy && diasEntre_(hoy, r.fechaLimite) <= 1);

  const total = vencidas.length + deHoy.length + proximas.length + actasRetraso.length + actasPorVencer.length;
  if (total === 0) {
    Logger.log('Sin alertas hoy — no se envía correo.');
    return;
  }

  const fila = (color, titulo, sub) =>
    '<tr><td style="padding:9px 12px;border-left:4px solid ' + color + ';background:#F7F9FC;border-bottom:6px solid #fff;">' +
    '<strong style="color:#1B2437;font-size:13px;">' + titulo + '</strong><br>' +
    '<span style="color:#4A5872;font-size:12px;">' + sub + '</span></td></tr>';

  let cuerpo = '';
  const seccion = t => '<tr><td style="padding:16px 0 8px;font-size:13px;font-weight:bold;color:#0E2E7E;text-transform:uppercase;letter-spacing:1px;">' + t + '</td></tr>';

  if (vencidas.length) {
    cuerpo += seccion('🔴 Programaciones VENCIDAS (' + vencidas.length + ')');
    vencidas.sort((a, b) => b.dias - a.dias).forEach(x => {
      cuerpo += fila('#C62828', x.p.supervisor + ' — ' + x.p.tema,
        (x.p.sector || '') + ' · fechas: ' + fechasDeProg_(x.p).map(fmt_).join(', ') + ' · <b>' + x.dias + ' día(s) de atraso</b>');
    });
  }
  if (deHoy.length) {
    cuerpo += seccion('🟡 Para HOY / En curso (' + deHoy.length + ')');
    deHoy.forEach(x => {
      cuerpo += fila('#B07B10', x.p.supervisor + ' — ' + x.p.tema,
        (x.p.sector || '') + ' · fechas: ' + fechasDeProg_(x.p).map(fmt_).join(', '));
    });
  }
  if (proximas.length) {
    cuerpo += seccion('🔵 Próximas a vencer — ' + CONFIG.DIAS_ANTICIPACION + ' días o menos (' + proximas.length + ')');
    proximas.sort((a, b) => a.dias - b.dias).forEach(x => {
      cuerpo += fila('#1B55D6', x.p.supervisor + ' — ' + x.p.tema,
        (x.p.sector || '') + ' · programada para el <b>' + fmt_(fechasDeProg_(x.p)[0]) + '</b> (' +
        (x.dias === 1 ? 'MAÑANA' : 'en ' + x.dias + ' días') + ')');
    });
  }
  if (actasPorVencer.length) {
    cuerpo += seccion('🟠 Actas por vencer HOY o MAÑANA (' + actasPorVencer.length + ')');
    actasPorVencer.forEach(r => {
      cuerpo += fila('#D2691E', r.supervisor + ' — ' + r.tema,
        'Ejecutada el ' + fmt_(r.fechaEjecucion) + ' · límite de envío: <b>' + fmt_(r.fechaLimite) + '</b>');
    });
  }
  if (actasRetraso.length) {
    cuerpo += seccion('🔴 Actas con RETRASO de envío (' + actasRetraso.length + ')');
    actasRetraso.forEach(r => {
      cuerpo += fila('#C62828', r.supervisor + ' — ' + r.tema,
        'Ejecutada el ' + fmt_(r.fechaEjecucion) + ' · el límite era el <b>' + fmt_(r.fechaLimite) + '</b> y aún no se registra envío');
    });
  }

  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #E2E8F3;border-radius:14px;overflow:hidden;">' +
    '<div style="background:#0A1633;padding:22px 26px;">' +
    '<div style="color:#fff;font-size:17px;font-weight:bold;">Sistema ETI — Alertas de Vencimiento</div>' +
    '<div style="color:#8FB4F5;font-size:12px;margin-top:4px;">Capacitaciones de Ética e Integridad · Verfrut · ' +
    Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy') + '</div></div>' +
    '<div style="padding:10px 26px 24px;"><table style="width:100%;border-collapse:collapse;">' + cuerpo + '</table>' +
    '<p style="font-size:11px;color:#7C89A3;margin-top:18px;">Este correo se genera automáticamente todos los días a las ' +
    CONFIG.HORA_CORREO + ':00 h cuando existen alertas. Revisa el detalle en el Sistema ETI.</p></div></div>';

  MailApp.sendEmail({
    to: CONFIG.DESTINATARIOS,
    subject: '⚠️ Sistema ETI: ' + total + ' alerta(s) de vencimiento — ' + Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy'),
    htmlBody: html
  });
  Logger.log('Correo de alertas enviado (%s alertas).', total);
}

// ═══════════════ 5. INSTALACIÓN DE ACTIVADORES ═══════════════

/** ► EJECUTAR UNA SOLA VEZ para programar la sincronización y el correo */
function instalarActivadores() {
  // Elimina activadores anteriores de este script
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Sincronizar con Sheets cada hora
  ScriptApp.newTrigger('sincronizarTodo').timeBased().everyHours(1).create();

  // Correo diario de alertas
  ScriptApp.newTrigger('enviarAlertasDiarias').timeBased().atHour(CONFIG.HORA_CORREO).everyDays(1).inTimezone('America/Lima').create();

  // Primera sincronización inmediata
  sincronizarTodo();
  Logger.log('Activadores instalados: sincronización cada hora y correo diario a las %s:00.', CONFIG.HORA_CORREO);
}

/** Menú en la hoja para uso manual */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙️ Sistema ETI')
    .addItem('Sincronizar ahora', 'sincronizarTodo')
    .addItem('Enviar correo de alertas ahora', 'enviarAlertasDiarias')
    .addSeparator()
    .addItem('Instalar activadores automáticos', 'instalarActivadores')
    .addToUi();
}
