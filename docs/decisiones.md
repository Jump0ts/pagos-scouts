# Registro de decisiones

Cada decisión se debatió antes de tomarla. Para cambiar una, se añade una entrada nueva que la sustituya.
No se borra la antigua.

## Bloque 1 — Modelo y funcionamiento (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-1 | **El pagador aprendido se liga a la familia** | Al clasificar un pago de alguien no registrado, su nombre (tal como sale en el banco) queda ligado a la familia, no a niños sueltos. Sus pagos futuros se cuadran contra las deudas pendientes de todos los hermanos, estén en la sección que estén. |
| D-2 | **Existe el Curso, con asistente de paso de curso** | Cada niño tiene una matrícula por curso (sección en ese curso). Al abrir un curso nuevo, la app propone subir a cada niño a la siguiente sección y el usuario confirma o corrige. Eventos y deudas pertenecen a un curso; los cursos anteriores quedan consultables. |
| D-3 | **Secciones por defecto y configurables por grupo** | Todo grupo nuevo empieza con Castores, Manada, Tropa, Unidad, Clan y Scouters, en ese orden (de menor a mayor). Se pueden renombrar, añadir y archivar. El orden sirve para el paso de curso y para el 2º hermano. |
| D-4 | **Dos tipos de evento** | *Toda la sección* (cuota, censo): genera una deuda para cada niño matriculado en las secciones elegidas. *Con apuntados* (acampadas, campamentos): solo para los niños marcados como asistentes. Ambos con fechas de inicio y fin, precio por sección, precio opcional de 2º hermano y excepciones por niño (excluir, importe personalizado). |
| D-4b | **El precio de 2º hermano se aplica a los más pequeños** | Dentro de una familia y un evento, el mayor paga el precio completo y el resto, el de hermano. Se ordena por fecha de nacimiento si existe (campo opcional) y, si no, por el orden de las secciones. |
| D-5 | **Clasificación automática solo sin duda** | Se clasifica sola si se cumplen las dos condiciones: (1) familia segura, por pagador aprendido o porque coinciden el nombre y todos los apellidos del listado; y (2) el importe cuadra exactamente con una **única** combinación de deudas pendientes de esa familia en eventos activos. Todo lo demás va a **Dudas**, con la mejor sugerencia preseleccionada. Toda clasificación se puede deshacer y queda registrado quién la hizo. |
| D-5b | **Se aceptan pagos parciales** | Una deuda puede quedar *a medias* con lo que falta por pagar. El siguiente pago de la familia se intenta cuadrar con lo pendiente. No se definen plazos en el evento. Un pago parcial nunca se clasifica solo: siempre va a Dudas. |
| D-5c | **Los sobrantes son saldo a favor de la familia** | Si un pago supera lo que se debe, o no encaja con ningún evento todavía, lo que sobra queda como saldo de la familia. Al crear un evento, la app propone aplicar ese saldo y el usuario confirma. Las devoluciones de dinero se registran como tales. |

## Bloque 2 — Stack e infraestructura (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-6 | **Front: React + Vite + TypeScript como PWA** | Se sirve como ficheros estáticos con nginx y es instalable en Android e iPhone (manifest + service worker con `vite-plugin-pwa`). Incluye una guía dentro de la app para "Añadir a pantalla de inicio" en iPhone. |
| D-7 | **Tailwind puro con diseño propio** | Sin librería de componentes. Se parte de la maqueta `maquetas/src/tailwind/`: verde bosque y ámbar, neutros con matiz verde, un color por sección, Bricolage Grotesque para títulos y Figtree para texto, el movimiento presentado como justificante bancario y la barra de acción fija abajo en el móvil. Los componentes son propios, así que su accesibilidad (foco, teclado, lectores de pantalla) es responsabilidad nuestra y se prueba en cada parte. |
| D-7b | **Radix Primitives para las piezas complejas** | Diálogos, menús, desplegables, el buscador con sugerencias y avisos usan primitivas de Radix sin estilos, que aportan foco, teclado y lectores de pantalla; el aspecto es siempre el diseño propio con Tailwind. Botones, tarjetas, listas y formularios simples son componentes propios. |
| D-8 | **Back: el stack de My Money** | Node + TypeScript + Express + Prisma + PostgreSQL + Zod, organizado por dominios (`backend/src/modules/<dominio>/`). Excel con SheetJS instalado desde su web oficial (`cdn.sheetjs.com`), nunca desde npm. |
| D-9 | **Sesión con cookie `httpOnly`** | Sesiones guardadas en Postgres y revocables. Cookie `HttpOnly; Secure; SameSite=Lax`. Web y API en el mismo dominio (la API bajo `/api`), así que no hace falta CORS. |
| D-10a | **Producción en un droplet propio en la UE** | Droplet de 1 GB en Fráncfort o Ámsterdam, solo para esta app. Aislado de travel_agency y de My Money. Mismo modelo de despliegue que My Money: imagen en GHCR, despliegue por digest y aprobación manual. |
| D-10b | **Pre en el servidor de casa** | Mismo esquema que My Money: nginx, Certbot y DNS dinámico. Solo datos inventados, nunca reales. |
| D-10c | **Repositorio público sin datos reales** | `Jump0ts/pagos-scouts`. Los tests usan fixtures inventadas y el `.gitignore` bloquea `*.xls`, `*.xlsx` y `*.csv` fuera de `tests/fixtures/`. |
| D-10d | **Subdominios de josanfersal.dev** | `scouts.josanfersal.dev` para producción y `pre-scouts.josanfersal.dev` para pre. DNS en Cloudflare, en modo "solo DNS". |
| D-11 | **Preparado para varios grupos, arranca solo con el tuyo** | Todo cuelga de `Grupo` y cada consulta se filtra por grupo, con tests que lo comprueban. El registro está cerrado: los grupos solo los da de alta un superadministrador. Abrirlo a otros grupos queda pendiente de la parte legal (contrato de encargo, exportar y borrar los datos de un grupo). |

## Bloque 3 — Parte 0 (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-12 | **nginx propio delante de la API** | Una sola imagen lleva la API y la web compilada (como en My Money). Un contenedor nginx sin root, de solo lectura y sin capabilities, sirve la web con sus cabeceras de seguridad y pasa `/api` al contenedor de la API. El nginx del servidor solo termina TLS. |
| D-13 | **Pre lo lanza el usuario** | Claude prepara `deploy/pre/` (compose, `.env.pre.example`, nginx y guía). El usuario crea el DNS y ejecuta los comandos en su servidor; Claude no toca DNS ni servidor. |

## Consecuencias del bloque 1 en el modelo de datos

- `Educando.fechaNacimiento` (opcional), necesaria para D-4b.
- `Seccion.orden`, necesaria para D-2 y D-4b.
- `Matricula (educando, curso, seccion)`, en lugar de guardar la sección en el educando.
- `Evento.tipo` (`TODA_SECCION` | `CON_APUNTADOS`), `PrecioSeccion (evento, seccion, importe)` y
  `Evento.precioHermano` (opcional).
- `Cargo.importe` calculado al generar la deuda; puede sustituirse por un importe personalizado.
- `Asignacion (movimiento, cargo, importe)`; el estado de un cargo (pendiente, parcial o pagado) se calcula
  a partir de sus asignaciones.
- `SaldoFamilia`: movimientos de saldo a favor (entradas por sobrante, salidas por aplicación a un cargo o
  por devolución).
