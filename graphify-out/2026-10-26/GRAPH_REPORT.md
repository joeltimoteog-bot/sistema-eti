# Graph Report - sistema-eti  (2026-10-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 212 nodes · 523 edges · 15 communities
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f4899fb`
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
- initProgramacion
- entrarConUsuario
- calcularFechaLimite
- instalarCierreHorario
- addDoc
- showToast
- initForm
- intentarLogin

## God Nodes (most connected - your core abstractions)
1. `entrarConUsuario()` - 19 edges
2. `instalarAlertasPendientes()` - 18 edges
3. `instalarPresenciaChat()` - 17 edges
4. `esc()` - 16 edges
5. `showToast()` - 15 edges
6. `estadoProg()` - 14 edges
7. `formatDateDisplay()` - 13 edges
8. `renderDashboard()` - 13 edges
9. `renderProgramaciones()` - 12 edges
10. `initProgramacion()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `initBotones()` --indirect_call--> `exportarExcel()`  [INFERRED]
  script.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `exportRankingPDF()`  [INFERRED]
  script.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `exportStatsPDF()`  [INFERRED]
  script.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `renderEstadisticas()`  [INFERRED]
  script.js → js/estadisticas.js
- `initBotones()` --indirect_call--> `renderRanking()`  [INFERRED]
  script.js → js/estadisticas.js

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "esc"
Cohesion: 0.18
Nodes (31): calcularAlertas(), calcularEstado(), cobDeProg(), contarDiasHabiles(), esc(), escucharProgramaciones(), esMiaProg(), esReemplazoDe() (+23 more)

### Community 1 - "script.js"
Cohesion: 0.07
Nodes (23): app, calAnio, calMes, _CTX, db, editFechasOrig, editFechasSel, ESTADO_META (+15 more)

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
Cohesion: 0.35
Nodes (10): instalarEstadisticas(), calcularRanking(), exportarExcel(), exportRankingPDF(), exportStatsPDF(), poblarAnios(), renderChartsStats(), renderEstadisticas() (+2 more)

### Community 7 - "initProgramacion"
Cohesion: 0.25
Nodes (11): actualizarHeaderFecha(), detectarTemporada(), diasHabilesRango(), esDiaHabil(), esFestivo(), fechasHabilesDelRango(), guardarProgramacion(), initProgramacion() (+3 more)

### Community 8 - "entrarConUsuario"
Cohesion: 0.20
Nodes (11): aplicarLinkRRLL(), aplicarRol(), entrarConUsuario(), escucharUsuarios(), iniciales(), initFiltros(), initNotificaciones(), initTabs() (+3 more)

### Community 9 - "calcularFechaLimite"
Cohesion: 0.24
Nodes (11): calcularFechaLimite(), cerrarFormSup(), escucharFirebase(), guardarRegistro(), guardarRegistroSupervisor(), initPanelSupervisor(), limpiarFormulario(), mostrarPreview() (+3 more)

### Community 10 - "instalarCierreHorario"
Cohesion: 0.40
Nodes (9): instalarCierreHorario(), acCerrar(), acEsc(), acFuera(), acMostrar(), acQuitar(), acUkey(), acUser() (+1 more)

### Community 11 - "addDoc"
Cohesion: 0.31
Nodes (9): addDoc(), borrarTodo(), deleteDoc(), escucharSupervisores(), poblarSelectsSupervisores(), _prog(), renderListaSups(), _T() (+1 more)

### Community 12 - "showToast"
Cohesion: 0.39
Nodes (9): crearNuevoIntegrante(), etiHash(), exportUsuariosExcel(), generarCredenciales(), guardarUsuario(), initUsuariosAdmin(), migrarCuentasAHuella(), showToast() (+1 more)

### Community 13 - "initForm"
Cohesion: 0.50
Nodes (4): generarAreas(), generarRutas(), initForm(), verificarRetrasoForm()

### Community 14 - "intentarLogin"
Cohesion: 0.67
Nodes (3): initLogin(), intentarLogin(), mostrarAvisoIngresoRRLL()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `initBotones()` connect `initBotones` to `entrarConUsuario`, `script.js`, `addDoc`, `calcularFechaLimite`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `instalarPresenciaChat()` (e.g. with `rlPresenciaDetener()` and `rlPresenciaIniciar()`) actually correct?**
  _`instalarPresenciaChat()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `entrarConUsuario()` connect `entrarConUsuario` to `esc`, `script.js`, `initBotones`, `initProgramacion`, `calcularFechaLimite`, `addDoc`, `showToast`, `initForm`, `intentarLogin`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._