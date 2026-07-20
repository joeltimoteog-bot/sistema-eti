# Guía de instalación — Google Sheets + Correos de alerta

El Sistema ETI v6.0 guarda sus datos en Firebase (la nube). Con esta guía vas a conectar una hoja de **Google Sheets** que se actualiza sola **cada hora** con todos los datos, y un **correo diario a las 7 a.m.** con las programaciones próximas a vencer, las de hoy, las vencidas y las actas con retraso.

Solo se hace **una vez** y toma unos 10 minutos.

---

## Paso 1 — Crear la hoja de cálculo

1. Entra a [sheets.google.com](https://sheets.google.com) con tu cuenta (joel.timoteog@gmail.com).
2. Crea una hoja nueva y ponle de nombre: **Sistema ETI — Base de Datos**.

## Paso 2 — Abrir el editor de Apps Script

1. Dentro de la hoja, ve al menú **Extensiones → Apps Script**.
2. Se abre una pestaña con un editor de código. Borra todo lo que aparezca en el archivo `Código.gs`.

## Paso 3 — Pegar el código

1. Abre el archivo **`google-apps-script.gs`** (está en la carpeta del sistema).
2. Copia TODO su contenido y pégalo en el editor de Apps Script.
3. Revisa la sección `CONFIG` al inicio del código:
   - `DESTINATARIOS`: correos que recibirán las alertas. Puedes poner varios separados por coma, por ejemplo:
     `'joel.timoteog@gmail.com, ovilela@verfrut.cl'`
   - `HORA_CORREO`: hora del correo diario (7 = 7 a.m. hora de Perú).
   - `DIAS_ANTICIPACION`: con cuántos días de anticipación avisar (3 por defecto).
4. Guarda con el ícono del disquete (o Ctrl+S).

## Paso 4 — Instalar los activadores automáticos

1. En la barra superior del editor, donde dice el nombre de la función, elige **`instalarActivadores`**.
2. Pulsa **▶ Ejecutar**.
3. La primera vez Google te pedirá permisos:
   - Pulsa **Revisar permisos** → elige tu cuenta.
   - Si aparece "Google no verificó esta app", pulsa **Configuración avanzada → Ir a … (no seguro)** — es tu propio script, es seguro.
   - Acepta los permisos (leer/editar la hoja, conectarse a internet y enviar correo).
4. Al terminar verás en la hoja las pestañas **Capacitaciones, Programaciones, Supervisores y Cuentas Supervisores** con todos los datos.

Con esto queda instalado:

| Tarea | Frecuencia |
|---|---|
| Sincronizar Firebase → Google Sheets | Cada hora |
| Correo de alertas de vencimiento | Todos los días a las 7 a.m. (solo si hay alertas) |

## Paso 5 — Uso diario (opcional)

Al abrir la hoja verás un menú **⚙️ Sistema ETI** con:

- **Sincronizar ahora** — actualiza los datos al instante sin esperar la hora.
- **Enviar correo de alertas ahora** — fuerza el envío del resumen en este momento.

La pestaña **_Sync** muestra la fecha y hora de la última sincronización.

---

## Preguntas frecuentes

**¿Puedo editar los datos en la hoja?**
La hoja es un espejo de respaldo: cada sincronización la reescribe con lo que hay en el sistema. Los cambios se hacen siempre en el Sistema ETI, no en la hoja. Si quieres hacer análisis propios, crea pestañas nuevas con otros nombres (no se tocan).

**¿El correo llega todos los días?**
Solo cuando hay algo que avisar. Si no hay programaciones próximas, vencidas ni actas en riesgo, no se envía nada.

**¿Cómo agrego más destinatarios?**
Edita `DESTINATARIOS` en el código y guarda. No hace falta reinstalar los activadores.

**¿Cómo desactivo todo?**
En el editor de Apps Script, ícono de reloj (Activadores) → eliminar los activadores.
