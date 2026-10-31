# Discovery OS

MVP configurable de conversaciones de discovery. Cada empresa define objetivo, contexto, catálogo y datos que desea comprender; la IA analiza cada respuesta y genera la siguiente pregunta. Incluye plantillas de Mood Agency, Norte Industrial y Clínica Sonrisa.

## Despliegue en Vercel + Supabase

Requiere Node.js 24 y un proyecto Supabase dedicado. La configuración de Vercel está en `vercel.json`.

Variables de producción:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública para Auth |
| `SUPABASE_SECRET_KEY` | Clave del servidor para la persistencia privada |
| `OPENAI_API_KEY` | Clave del motor conversacional |
| `OPENAI_MODEL` | Modelo con Structured Outputs; predeterminado `gpt-6.1-terra` |
| `AI_PROVIDER` | `openai` o `anthropic`, selección explícita del proveedor |
| `ANTHROPIC_API_KEY` | Clave de Claude si se selecciona Anthropic |
| `ANTHROPIC_MODEL` | Modelo Claude; predeterminado `claude-sonnet-5-5` |
| `ANTHROPIC_WORKSPACE_ID` | ID `wrkspc_...` cuando la clave de Anthropic requiere seleccionar workspace |
| `APP_BASE_URL` | Origen canónico opcional; Vercel también proporciona sus URLs de sistema |
| `APP_ENCRYPTION_KEY` | Opcional: 32 bytes en base64 para claves por empresa |

Los secretos no usan el prefijo `NEXT_PUBLIC_`. No subir `.env.local`, archivos de `.data`, archivos originales del proyecto ni claves al repositorio. Sin `APP_ENCRYPTION_KEY`, las claves de IA se administran en Vercel y no desde el formulario del panel.

1. Aplicar `supabase/migrations/20261031024251_cloud_storage.sql` al proyecto dedicado.
2. Autorizar el correo de la primera administradora en `discovery_owner_invites`, por namespace y empresa. Estos datos administrativos no se incluyen en el repositorio.
3. Conectar este repositorio al proyecto Vercel, declarar las variables y desplegar.
4. Configurar en Supabase Auth la Site URL del despliegue.
5. En la aplicación, usar **Primer acceso · crear mi cuenta**, elegir una contraseña y confirmar el correo. Solo los correos previamente autorizados pueden obtener membresías iniciales.

En nube el acceso usa Supabase Auth, cookies HttpOnly y membresías comprobadas en cada solicitud administrativa. La contraseña local `discovery-demo` no permite entrar en Vercel. Los roles `owner` y `analyst` se aplican en servidor; una baja de membresía impide nuevas solicitudes aunque la cookie siga vigente. La sesión requiere iniciar sesión de nuevo cuando caduca el token de Auth.

## Datos y ejecución

El MVP cloud utiliza un documento JSONB privado en PostgreSQL, con revisiones y compare-and-swap para evitar escrituras perdidas entre instancias. Es una transición acotada desde el prototipo: el modelo relacional completo por entidad queda pendiente. Las tablas tienen RLS y permisos explícitos; los visitantes no reciben acceso a los documentos de estado. El backend autoriza cada empresa y cada ejecución.

Vercel utiliza automáticamente almacenamiento Supabase. Fuera de Vercel, `DISCOVERY_STORAGE=supabase` lo activa expresamente. Preview usa un namespace separado; requiere sus propias variables. No usar datos reales en previews.

Las llamadas a IA se hacen fuera de las escrituras de datos. Cada turno usa revisión, lease y operación idempotente. Se reservan dos solicitudes por turno para cubrir un reintento. Cambiar una respuesta invalida la continuación. La salida JSON, el catálogo y los números de evidencia se validan en servidor. No hay fallback silencioso a una simulación si falla la IA.

Los cuestionarios predefinidos conservan su investigación e informe simulados. En nube esas etapas breves se procesan durante peticiones autorizadas y pueden reanudarse desde checkpoints; no dependen de un proceso permanente de Node. Una cola distribuida con proveedores reales de investigación sigue pendiente.

## Desarrollo local

```powershell
npm ci
npm run dev
```

Abrir `http://127.0.0.1:3000`. Sin modo Supabase, se usa SQLite en `.data/discovery.sqlite` y acceso demo. `npm run dev` inicia también el worker local de los cuestionarios predefinidos. `npm start` solo inicia Next.js; para usar ese worker con una compilación local, ejecutar `npm run worker` en otra terminal.

## Verificación

```powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Los tests E2E usan una base independiente y un doble de IA explícito; no consumen saldo ni certifican integración real. La prueba de persistencia cloud verifica conflictos de revisiones y autorización contra un servidor HTTP controlado.

## Límites del MVP

El ejemplo dental segmenta intereses por servicio, no determina diagnósticos, tratamientos ni candidaturas. Usar personas ficticias durante la validación del piloto. Quedan pendientes CRM/contactos, agenda, recuperación avanzada de cuentas, retención automática, esquema relacional por entidad, investigación web real y evaluación de calidad de modelos.

El motor admite OpenAI Responses y Claude Messages con salida estructurada y validación compartida. El proveedor se selecciona explícitamente mediante `AI_PROVIDER` o desde la conexión de la empresa; no se cambia automáticamente al fallar una llamada. Los errores de saldo o cuota se muestran sin publicar un resultado simulado.
