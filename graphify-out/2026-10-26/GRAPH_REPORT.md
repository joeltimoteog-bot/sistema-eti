# Graph Report - sistema-eti  (2026-10-26)

## Corpus Check
- 23 files · ~31,935 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .gs 1, .css 1)

## Summary
- 349 nodes · 739 edges · 27 communities (24 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `206bf853`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- esc
- script.js
- guia.js
- instalarAlertasPendientes
- instalarPresenciaChat
- solreprog.js
- initBotones
- estadoProg
- entrarConUsuario
- calcularFechaLimite
- instalarCierreHorario
- 01-core.js
- showToast
- 09-programacion.js
- 02-sesion.js
- 03-datos-base.js
- 14-usuarios.js
- Guía de instalación — Google Sheets + Correos de alerta
- renderPanelSupervisor
- 11-reprogramacion.js
- 13-mi-panel.js
- 10-salud-calendario.js
- 12-notificaciones.js
- 05-dashboard.js
- 08-supervisores.js

## God Nodes (most connected - your core abstractions)
1. `entrarConUsuario()` - 19 edges
2. `instalarAlertasPendientes()` - 18 edges
3. `instalarPresenciaChat()` - 17 edges
4. `esc()` - 16 edges
5. `showToast()` - 15 edges
6. `estadoProg()` - 14 edges
7. `renderDashboard()` - 13 edges
8. `formatDateDisplay()` - 13 edges
9. `initProgramacion()` - 12 edges
10. `renderProgramaciones()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `initBotones()` --indirect_call--> `exportarExcel()`  [INFERRED]
  script.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `exportarExcel()`  [INFERRED]
  src/04-formulario.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `renderRanking()`  [INFERRED]
  script.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `renderRanking()`  [INFERRED]
  src/04-formulario.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `exportRankingPDF()`  [INFERRED]
  script.js → js/estadisticas.js

## Import Cycles
- None detected.

## Communities (27 total, 3 thin omitted)

### Community 0 - "esc"
Cohesion: 0.20
Nodes (18): calcularAlertas(), calcularEstado(), esc(), formatDateDisplay(), initFiltros(), mostrarResumenSiCorresponde(), poblarFiltros(), renderAlertasProg() (+10 more)

### Community 1 - "script.js"
Cohesion: 0.08
Nodes (30): app, calAnio, calMes, _CTX, db, editFechasOrig, editFechasSel, escucharSupervisores() (+22 more)

### Community 2 - "guia.js"
Cohesion: 0.18
Nodes (18): arrancar(), bot(), crear(), emit(), guia(), irTab(), logueado(), nombre() (+10 more)

### Community 3 - "instalarAlertasPendientes"
Cohesion: 0.26
Nodes (18): instalarAlertasPendientes(), actualizar(), cargarCaps(), cargarEvals(), cargarRRLL(), coincide(), escA(), fmtD() (+10 more)

### Community 4 - "instalarPresenciaChat"
Cohesion: 0.25
Nodes (16): instalarPresenciaChat(), rlAbrirChat(), rlBadge(), rlCrearChatUI(), rlEnviarMsg(), rlHora(), rlMarcarLeidos(), rlMarcarPresencia() (+8 more)

### Community 5 - "solreprog.js"
Cohesion: 0.29
Nodes (13): cargar(), css(), dm(), enc(), enviar(), esc(), hoy(), norm() (+5 more)

### Community 6 - "initBotones"
Cohesion: 0.11
Nodes (29): instalarEstadisticas(), calcularRanking(), exportarExcel(), exportRankingPDF(), exportStatsPDF(), poblarAnios(), renderChartsStats(), renderEstadisticas() (+21 more)

### Community 7 - "estadoProg"
Cohesion: 0.40
Nodes (13): estadoProg(), exportIncumplimientosPDF(), exportProgExcel(), fechasDeProg(), fechasHabilesDelRango(), formatDate(), guardarProgramacion(), initProgramacion() (+5 more)

### Community 8 - "entrarConUsuario"
Cohesion: 0.20
Nodes (15): aplicarLinkRRLL(), aplicarRol(), cerrarFormSup(), entrarConUsuario(), escucharUsuarios(), guardarRegistroSupervisor(), iniciales(), initNotificaciones() (+7 more)

### Community 9 - "calcularFechaLimite"
Cohesion: 0.24
Nodes (10): actualizarHeaderFecha(), calcularFechaLimite(), contarDiasHabiles(), detectarTemporada(), diasHabilesRango(), escucharFirebase(), esDiaHabil(), esFestivo() (+2 more)

### Community 10 - "instalarCierreHorario"
Cohesion: 0.40
Nodes (9): instalarCierreHorario(), acCerrar(), acEsc(), acFuera(), acMostrar(), acQuitar(), acUkey(), acUser() (+1 more)

### Community 11 - "01-core.js"
Cohesion: 0.10
Nodes (18): addDoc(), app, _CTX, db, deleteDoc(), { exportarExcel, renderRanking, exportRankingPDF, renderEstadisticas, exportStatsPDF }, FESTIVOS_PERU, firebaseConfig (+10 more)

### Community 12 - "showToast"
Cohesion: 0.24
Nodes (15): addDoc(), borrarTodo(), crearNuevoIntegrante(), deleteDoc(), etiHash(), exportUsuariosExcel(), generarCredenciales(), guardarUsuario() (+7 more)

### Community 13 - "09-programacion.js"
Cohesion: 0.31
Nodes (16): cobDeProg(), escucharProgramaciones(), esMiaProg(), esReemplazoDe(), estadoProg(), exportIncumplimientosPDF(), exportProgExcel(), fechasDeProg() (+8 more)

### Community 14 - "02-sesion.js"
Cohesion: 0.27
Nodes (11): aplicarLinkRRLL(), aplicarRol(), entrarConUsuario(), iniciales(), initLogin(), intentarLogin(), migrarCuentasAHuella(), mostrarAvisoIngresoRRLL() (+3 more)

### Community 15 - "03-datos-base.js"
Cohesion: 0.30
Nodes (10): actualizarHeaderFecha(), calcularEstado(), calcularFechaLimite(), contarDiasHabiles(), detectarTemporada(), escucharFirebase(), esDiaHabil(), esFestivo() (+2 more)

### Community 16 - "14-usuarios.js"
Cohesion: 0.42
Nodes (8): crearNuevoIntegrante(), escucharUsuarios(), exportUsuariosExcel(), generarCredenciales(), guardarUsuario(), initUsuariosAdmin(), renderListaUsuarios(), sugerirCredenciales()

### Community 17 - "Guía de instalación — Google Sheets + Correos de alerta"
Cohesion: 0.25
Nodes (7): Guía de instalación — Google Sheets + Correos de alerta, Paso 1 — Crear la hoja de cálculo, Paso 2 — Abrir el editor de Apps Script, Paso 3 — Pegar el código, Paso 4 — Instalar los activadores automáticos, Paso 5 — Uso diario (opcional), Preguntas frecuentes

### Community 18 - "renderPanelSupervisor"
Cohesion: 0.33
Nodes (7): cobDeProg(), escucharProgramaciones(), esMiaProg(), esReemplazoDe(), progMasUrgente(), renderAvisoSupervisor(), renderPanelSupervisor()

### Community 19 - "11-reprogramacion.js"
Cohesion: 0.29
Nodes (3): editFechasOrig, editFechasSel, progFechasSel

### Community 20 - "13-mi-panel.js"
Cohesion: 0.52
Nodes (6): cerrarFormSup(), guardarRegistroSupervisor(), initPanelSupervisor(), progMasUrgente(), renderAvisoSupervisor(), renderPanelSupervisor()

### Community 23 - "12-notificaciones.js"
Cohesion: 0.60
Nodes (3): calcularAlertas(), mostrarResumenSiCorresponde(), renderNotificaciones()

### Community 24 - "05-dashboard.js"
Cohesion: 0.83
Nodes (3): renderAvanceSupervisores(), renderChartsDashboard(), renderDashboard()

### Community 25 - "08-supervisores.js"
Cohesion: 0.83
Nodes (3): escucharSupervisores(), poblarSelectsSupervisores(), renderListaSups()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initBotones()` connect `initBotones` to `entrarConUsuario`, `script.js`, `showToast`, `calcularFechaLimite`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `instalarPresenciaChat()` (e.g. with `rlPresenciaDetener()` and `rlPresenciaIniciar()`) actually correct?**
  _`instalarPresenciaChat()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07661290322580645 - nodes in this community are weakly interconnected._
- **Should `initBotones` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._
- **Should `01-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._