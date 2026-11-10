# Graph Report - sistema-eti  (2026-11-10)

## Corpus Check
- 24 files · ~34,926 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .diff 4, (none) 2, .gs 1)

## Summary
- 369 nodes · 792 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f2353da1`
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
- 06-registros.js
- instalarCierreHorario
- 01-core.js
- 09-programacion.js
- 02-sesion.js
- 03-datos-base.js
- 14-usuarios.js
- Guía de instalación — Google Sheets + Correos de alerta
- 11-reprogramacion.js
- 13-mi-panel.js
- 10-salud-calendario.js
- 12-notificaciones.js
- 05-dashboard.js
- 08-supervisores.js
- charts

## God Nodes (most connected - your core abstractions)
1. `entrarConUsuario()` - 20 edges
2. `instalarAlertasPendientes()` - 19 edges
3. `instalarPresenciaChat()` - 18 edges
4. `esc()` - 17 edges
5. `showToast()` - 16 edges
6. `formatDateDisplay()` - 15 edges
7. `renderDashboard()` - 13 edges
8. `renderProgramaciones()` - 13 edges
9. `initProgramacion()` - 12 edges
10. `estadoProg()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `initBotones()` --indirect_call--> `borrarTodo()`  [INFERRED]
  src/04-formulario.js → script.js
- `avisoReprogSup()` --indirect_call--> `formatDateDisplay()`  [INFERRED]
  src/13-mi-panel.js → script.js
- `entrarConUsuario()` --calls--> `rlPresenciaIniciar()`  [EXTRACTED]
  script.js → js/presencia-chat.js
- `renderTodo()` --calls--> `renderEstadisticas()`  [EXTRACTED]
  script.js → js/estadisticas.js
- `renderTodo()` --calls--> `renderRanking()`  [EXTRACTED]
  script.js → js/estadisticas.js

## Import Cycles
- None detected.

## Communities (24 total, 3 thin omitted)

### Community 0 - "esc"
Cohesion: 0.12
Nodes (44): avisoReprogSup(), calcularAlertas(), calcularEstado(), cobDeProg(), contarDiasHabiles(), esc(), esChecklistProg(), escucharProgramaciones() (+36 more)

### Community 1 - "script.js"
Cohesion: 0.06
Nodes (74): actualizarHeaderFecha(), addDoc(), aplicarLinkRRLL(), aplicarRol(), app, borrarTodo(), calAnio, calcularFechaLimite() (+66 more)

### Community 2 - "guia.js"
Cohesion: 0.18
Nodes (18): arrancar(), bot(), crear(), emit(), guia(), irTab(), logueado(), nombre() (+10 more)

### Community 3 - "instalarAlertasPendientes"
Cohesion: 0.26
Nodes (18): instalarAlertasPendientes(), actualizar(), cargarCaps(), cargarEvals(), cargarRRLL(), coincide(), escA(), fmtD() (+10 more)

### Community 4 - "instalarPresenciaChat"
Cohesion: 0.23
Nodes (18): instalarPresenciaChat(), rlAbrirChat(), rlBadge(), rlCrearChatUI(), rlEnviarMsg(), rlHora(), rlMarcarLeidos(), rlMarcarPresencia() (+10 more)

### Community 5 - "solreprog.js"
Cohesion: 0.29
Nodes (13): cargar(), css(), dm(), enc(), enviar(), esc(), hoy(), norm() (+5 more)

### Community 6 - "initBotones"
Cohesion: 0.18
Nodes (21): instalarEstadisticas(), calcularRanking(), exportarExcel(), exportRankingPDF(), exportStatsPDF(), poblarAnios(), renderChartsStats(), renderEstadisticas() (+13 more)

### Community 7 - "06-registros.js"
Cohesion: 0.60
Nodes (3): initFiltros(), poblarFiltros(), renderTabla()

### Community 10 - "instalarCierreHorario"
Cohesion: 0.40
Nodes (9): instalarCierreHorario(), acCerrar(), acEsc(), acFuera(), acMostrar(), acQuitar(), acUkey(), acUser() (+1 more)

### Community 11 - "01-core.js"
Cohesion: 0.10
Nodes (18): addDoc(), app, _CTX, db, deleteDoc(), { exportarExcel, renderRanking, exportRankingPDF, renderEstadisticas, exportStatsPDF }, FESTIVOS_PERU, firebaseConfig (+10 more)

### Community 13 - "09-programacion.js"
Cohesion: 0.26
Nodes (19): cambiosEjecucion(), cobDeProg(), esChecklistProg(), escucharProgramaciones(), esMiaProg(), esReemplazoDe(), estadoProg(), _estadoProgBase() (+11 more)

### Community 14 - "02-sesion.js"
Cohesion: 0.27
Nodes (11): aplicarLinkRRLL(), aplicarRol(), entrarConUsuario(), iniciales(), initLogin(), intentarLogin(), migrarCuentasAHuella(), mostrarAvisoIngresoRRLL() (+3 more)

### Community 15 - "03-datos-base.js"
Cohesion: 0.30
Nodes (10): actualizarHeaderFecha(), calcularEstado(), calcularFechaLimite(), contarDiasHabiles(), detectarTemporada(), escucharFirebase(), esDiaHabil(), esFestivo() (+2 more)

### Community 16 - "14-usuarios.js"
Cohesion: 0.38
Nodes (9): crearNuevoIntegrante(), escucharUsuarios(), _etiCargarElim(), exportUsuariosExcel(), generarCredenciales(), guardarUsuario(), initUsuariosAdmin(), renderListaUsuarios() (+1 more)

### Community 17 - "Guía de instalación — Google Sheets + Correos de alerta"
Cohesion: 0.25
Nodes (7): Guía de instalación — Google Sheets + Correos de alerta, Paso 1 — Crear la hoja de cálculo, Paso 2 — Abrir el editor de Apps Script, Paso 3 — Pegar el código, Paso 4 — Instalar los activadores automáticos, Paso 5 — Uso diario (opcional), Preguntas frecuentes

### Community 19 - "11-reprogramacion.js"
Cohesion: 0.29
Nodes (3): editFechasOrig, editFechasSel, progFechasSel

### Community 20 - "13-mi-panel.js"
Cohesion: 0.42
Nodes (8): avisoReprogSup(), cerrarFormSup(), guardarRegistroSupervisor(), initPanelSupervisor(), progMasUrgente(), renderAvisoSupervisor(), renderPanelSupervisor(), reprogSinVer()

### Community 23 - "12-notificaciones.js"
Cohesion: 0.60
Nodes (3): calcularAlertas(), mostrarResumenSiCorresponde(), renderNotificaciones()

### Community 24 - "05-dashboard.js"
Cohesion: 0.83
Nodes (3): renderAvanceSupervisores(), renderChartsDashboard(), renderDashboard()

### Community 25 - "08-supervisores.js"
Cohesion: 0.83
Nodes (3): escucharSupervisores(), poblarSelectsSupervisores(), renderListaSups()

### Community 27 - "charts"
Cohesion: 0.39
Nodes (6): charts(), grad(), hex2rgb(), mejorar(), rgba(), Wrap()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `instalarAlertasPendientes()` connect `instalarAlertasPendientes` to `script.js`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `instalarPresenciaChat()` (e.g. with `rlPresenciaDetener()` and `rlPresenciaIniciar()`) actually correct?**
  _`instalarPresenciaChat()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `esc` be split into smaller, more focused modules?**
  _Cohesion score 0.11945031712473574 - nodes in this community are weakly interconnected._
- **Why does `instalarPresenciaChat()` connect `instalarPresenciaChat` to `script.js`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05621621621621622 - nodes in this community are weakly interconnected._
- **Why does `initBotones()` connect `initBotones` to `script.js`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `01-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._