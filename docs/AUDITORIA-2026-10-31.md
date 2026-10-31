# Auditoría técnica y de experiencia — Discovery OS

Fecha: revisión iniciada el 30 y terminada el 31 de octubre de 2026. Alcance: aplicación Next.js, API, autenticación, configuración multicliente, conversación adaptativa, persistencia, exportaciones, seguridad y experiencia en escritorio y móvil.

## Correcciones realizadas

| Área | Hallazgo | Corrección |
|---|---|---|
| Datos públicos | El navegador del visitante recibía también perfil, resumen interno y metadatos de uso del modelo. | La respuesta pública conserva la conversación y orientación del paciente; perfil, resumen interno y uso del proveedor quedan en las vistas administrativas. |
| Persistencia | El autoguardado del cuestionario podía solaparse con un guardado posterior. | Cola de escrituras y suspensión del autoguardado durante envíos manuales. |
| Persistencia | El sondeo de resultados podía acumular peticiones y aplicar respuestas tras salir de la pantalla. | Una petición en curso por sondeo y descarte de resultados tras desmontar el componente. |
| Red | Una respuesta HTML de infraestructura producía errores de JSON poco claros; faltaba un límite de espera en el cliente. | Mensajes comprensibles para red, expiración y respuestas inválidas; tiempo máximo de espera y posibilidad de reintentar. |
| API | El límite anterior rechazaba configuraciones extensas que sí cumplían el esquema. | Hasta 256 KiB para administración/agencia; lectura del cuerpo con límite de bytes, también sin Content-Length. Se conserva un límite menor en endpoints públicos. |
| API | JSON nulo, listas o sintaxis inválida podían llegar al manejador como entradas inesperadas. | Validación del objeto JSON y respuesta 422 controlada. |
| Integraciones | Cambiar de proveedor podía conservar una clave del proveedor anterior. | Exigir la clave nueva cuando existe una clave cifrada y se cambia de proveedor; invalidar la verificación anterior. |
| Integraciones | Se podía comprobar una conexión distinta de los cambios aún sin guardar. | La comprobación se desactiva hasta guardar y se identifica el estado pendiente. |
| Integraciones | El indicador público ignoraba conexiones administradas por variables de entorno. | Comprobación con la configuración efectiva del servidor. |
| Autenticación | Cerrar sesión no eliminaba la cookie del JWT además de la sesión de la aplicación. | Se eliminan ambas cookies. |
| Constructor | Salir o recargar podía descartar cambios sin aviso. | Indicador de cambios pendientes, comprobación al salir del constructor y protección al abandonar la página. |
| Contacto | El correo y otros datos podían enviarse sin la validación nativa del navegador. | Formulario real con campos obligatorios, validación de correo, nombre y teléfono, además de la validación del servidor. |
| IA | Un campo marcado como rechazado podía carecer de evidencia; podían llegar opciones repetidas o motivos vacíos. | Validación de evidencia, opciones únicas y explicación mínima de los servicios. |
| Validación | Un texto compuesto solo por espacios cumplía la condición de respuesta obligatoria. | Rechazo de respuestas obligatorias vacías tras eliminar espacios. |
| Facts | El límite del tema era menor que el de los nombres de servicios. | Límites compatibles; conservación del último fact para evitar repetición inmediata al recargar. |
| Facts | Editar un banco extenso generaba una pantalla excesivamente larga. | Editor plegable por dato, con tema y vista previa. |
| Accesibilidad | Contraste insuficiente en numerosos textos secundarios, etiquetas y avisos. | Ajuste de colores de texto y contraste calculado para marcas con colores claros. |
| Accesibilidad | El acceso no utilizaba un diálogo con gestión nativa del foco. | Diálogo modal nativo; el teclado queda dentro de la ventana y el fondo permanece inactivo. |
| Accesibilidad | El contador alteraba el nombre accesible de la navegación; faltaba foco tras cambiar de pregunta. | Nombres accesibles estables, indicación de página activa y foco en la pregunta nueva. |
| Imágenes | Un logo externo no disponible mostraba una imagen rota. | Sustitución por icono de marca o conservación del nombre sin imagen rota. |
| UX | El segundo paso repetía el bloque visual completo de bienvenida antes del contacto. | Pantalla de contacto más compacta; campos legibles en móvil. |
| Diseño | Faltaba profundidad visual y coherencia entre estados. | Fondos ambientales suaves, superficies con profundidad, navegación más clara y transiciones breves. La entrada del contenido conserva su opacidad para mantener el contraste durante la animación. Se respeta la preferencia de reducir movimiento. |
| Seguridad web | Faltaban restricciones complementarias de navegador e indexación privada. | Cabeceras de permisos y CSP para formularios, objetos y marcos; noindex para administración, sesiones privadas y API. |
| Calidad continua | GitHub no ejecutaba los recorridos de navegador ni la auditoría de dependencias de producción. | Ambos se incorporan al flujo de CI. |

## Evidencias

- `npm test`: 20 pruebas aprobadas. Incluye contratos de IA, errores de red, contraste de marca, cifrado, evidencia, aislamiento, persistencia con CAS, exportaciones y facts.
- `npm run test:e2e`: 10 recorridos aprobados. Incluye crear/publicar landings, captación, personalización, edición de respuestas, resultado, exportación, borrado recuperable, límites, permisos y recuperación de fallos.
- axe-core: sin infracciones detectadas de las reglas WCAG 2 A/AA y WCAG 2.1 AA ejecutadas en acceso, agencia, vista general, sesiones, constructor, integraciones, configuración, bienvenida, contacto y resultado del visitante. Esta comprobación automática se limita a las pantallas y estados ensayados.
- Se comprueba el ancho móvil de 360 y 390 px y el escritorio. Se ejercitan la confirmación por teclado y el aviso de cambios pendientes.
- `npm run lint`, comprobación TypeScript y compilación de producción aprobadas.
- `npm audit --omit=dev`: 0 vulnerabilidades informadas en dependencias de producción.
- Capturas de los recorridos disponibles en `docs/screenshots/` del entorno local; utilizan datos sintéticos.

## Alcance de nube y puntos pendientes

- Las pruebas de navegador usan una base de datos aislada y un proveedor de IA explícitamente simulado. No constituyen una evaluación clínica ni una medición de precisión de Claude con pacientes reales.
- Se revisaron las migraciones: el estado de aplicación tiene RLS y no concede lectura a roles de navegador; la autorización utiliza membresías y valida el usuario en el servidor. Referencia utilizada: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
- El auditor remoto de Supabase respondió `You do not have permission to perform this action`. No se verificaron con ese auditor los ajustes actuales del proyecto remoto ni sus avisos. No se modificaron sus permisos ni su esquema durante esta auditoría.
- El análisis completo de npm conserva 16 avisos moderados en dependencias de desarrollo, originados en la cadena de ESLint/minimatch. La solución automática propuesta implica versiones incompatibles; no se aplicó `audit fix --force`. Son distintos del resultado de producción, que está limpio.
- La persistencia del MVP guarda el estado por namespace en un documento JSON con control de revisión. Antes de aumentar significativamente el volumen, conviene separar entidades y paginar consultas; no se ejecutó una prueba de carga para certificar capacidad.
- No se eliminaron landings ni prospectos reales. Las operaciones de escritura de prueba se hicieron en el entorno aislado.
