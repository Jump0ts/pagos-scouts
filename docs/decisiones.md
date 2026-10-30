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

## Bloque 4 — Parte 1: grupos, usuarios y secciones (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-14 | **Email y contraseña** | Contraseñas con argon2id. Tras 5 intentos fallidos para un mismo email, espera de 15 minutos. Sin envío de correos. |
| D-15 | **Altas por enlace de invitación** | Un administrador crea la invitación (email, rol y, para Scouter, sus secciones) y obtiene un enlace de un solo uso que caduca en 7 días. Lo envía él por el medio que quiera. Cada persona elige su propia contraseña. |
| D-16 | **Roles: Admin, Tesorería y Scouter** | Admin: todo, incluidos usuarios y ajustes. Tesorería: pagos, eventos, educandos, Dudas e importaciones, pero no usuarios. Scouter: solo consulta quién ha pagado y quién no en sus secciones; no ve importes de otras familias ni movimientos del banco. Un usuario puede pertenecer a varios grupos con un rol distinto en cada uno. |
| D-17 | **Primer grupo por comando en el servidor** | `crear-grupo` crea el grupo con sus secciones por defecto y devuelve la invitación de su primer administrador. No existe ninguna pantalla pública para crear grupos. |
| D-18 | **React Router** | Enrutado de la web, con rutas protegidas por rol. |
| D-19 | **TanStack Query** | Datos de la API en la web: caché, estados de carga y error, y refresco tras guardar. |
| D-20 | **React Hook Form + Zod** | Formularios de la web, validados con Zod, la misma librería que el back. |
| D-21 | **Restablecer contraseña con un enlace generado por un administrador** | Enlace de un solo uso que caduca en 24 horas. Al usarlo se cierran todas las sesiones de esa persona. Si quien olvida la contraseña es el único administrador, se usa el comando `restablecer` del servidor. |

| D-22 | **Login en una tarjeta centrada** | Logo, nombre y formulario en una tarjeta sobre el fondo del tema. Las pantallas de invitación y de restablecer contraseña usan el mismo estilo. Bajo el formulario se explica que, si se olvida la contraseña, hay que pedir un enlace a un administrador. |
| D-23 | **Cambio de grupo en la cabecera** | Bajo "Tesorería" se ve siempre el nombre del grupo activo; si el usuario tiene varios, al tocarlo se abre un menú para cambiar (Radix Dropdown Menu). |
| D-24 | **Ajustes con pestañas** | Una entrada "Ajustes" en la navegación con pestañas Personas · Secciones · Mi cuenta. Quien no es administrador solo ve "Mi cuenta". |
| D-25 | **Enlaces con Copiar y Compartir** | Las invitaciones y los enlaces de restablecer se muestran con un botón "Copiar" y, donde el navegador lo permite (móvil), "Compartir", que abre el menú del sistema con un mensaje ya escrito. La app nunca envía nada por su cuenta. |

## Bloque 5 — Parte 2: educandos, familias y cursos (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-26 | **Del educando, solo nombre, apellidos y nacimiento** | La fecha de nacimiento es opcional y solo sirve para el 2º hermano (D-4b). Nada de DNI, salud, dirección, fotos ni observaciones libres. |
| D-27 | **De los responsables, solo el nombre completo** | Es lo que necesita el motor para reconocer al pagador en el Excel del banco. Sin teléfonos ni emails. |
| D-28 | **Importación del listado en un asistente de 3 pasos** | 1) Subir el Excel y detectar los bloques (cada cabecera repetida es un bloque). 2) Elegir la sección de cada bloque y el curso. 3) Revisar las familias detectadas (uniones por erratas, niños sin responsables, coincidencias con lo que ya existe). Nada se guarda hasta confirmar. |
| D-29 | **Reimportar reconoce y actualiza** | Los niños y familias que ya existen se reconocen por nombre (tolerando erratas) y solo se actualiza su sección en el curso elegido. En la revisión se muestran los nuevos, los que cambian y los que no aparecen (posibles bajas), sin darlos de baja solos. |
| D-30 | **Baja y borrado controlado** | "Dar de baja" saca al niño del curso y conserva su historial. Un administrador puede borrar definitivamente a un niño o a una familia, salvo que tenga pagos registrados. El plazo de conservación automático se decidirá cuando existan los pagos. |
| D-31 | **El asistente de paso de curso, más adelante** | En la parte 2 se crea el curso al importar y se puede cambiar a un niño de sección a mano. El asistente (D-2) llega en una parte posterior, antes de septiembre de 2027. |
| D-32 | **Pantalla Educandos: lista por secciones y ficha de familia** | Buscador y filtros por sección; al tocar un niño se abre la ficha de su familia (hermanos, responsables y, más adelante, pagadores y pagos). Un scouter solo ve los niños de sus secciones y no abre fichas de familia. |
| D-33 | **Las columnas de pagos del Excel se ignoran por ahora** | Cuando existan los eventos (parte 3) se podrán leer como pagos ya hechos. |

## Bloque 6 — Parte 3: eventos y cargos (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-34 | **Precio de hermanos opcional y por posición** | Sustituye en parte a D-4/D-4b. Cada evento decide si tiene precio de hermanos. Si lo tiene: el 1º paga el precio de su sección, el 2º un precio fijo y el 3º y siguientes otro (si no se indica, el del 2º), iguales para todas las secciones. Nunca más que el precio de su sección. Solo cuentan los hermanos con cargo en ese mismo evento; el mayor (por fecha de nacimiento o, si falta, por sección) es el 1º. |
| D-35 | **Ajustes por niño con motivo** | Cada cargo admite un importe ajustado (0 € = exento) con un motivo opcional, o quitarlo del evento. El motivo solo lo ven Admin y Tesorería. Decidido por el usuario frente a la recomendación de no guardar motivos. |
| D-36 | **Las deudas se ajustan solas** | Altas: en un evento "toda la sección" abierto (hoy ≤ fecha de fin) se crea el cargo. Bajas: los cargos pendientes sin pagos se anulan; los pagados o a medias se quedan. Cambio de sección: se actualiza su precio. Tras cualquier cambio se recalculan las posiciones de hermanos: si se anula el cargo del mayor, el siguiente pasa a pagar el precio completo (desaparece el más barato). |
| D-37 | **Cambiar precios recalcula los pendientes** | Los cargos sin pagos se recalculan; los ajustados a mano conservan su importe. La app dice cuántos no se han tocado. |
| D-38 | **El scouter ve estado e importes de sus secciones** | Ve los eventos de sus secciones y, por niño, estado e importes (debido y pagado), pero no los motivos de los ajustes. Decidido por el usuario frente a la recomendación de mostrar solo el estado. |
| D-39 | **Pantallas: lista con progreso y detalle por sección** | Lista de eventos activos con su barra de cobrado (los pasados, plegados). Detalle con resumen, filtros por estado y sección, y los niños agrupados por sección. Crear y editar en un formulario de una pantalla. |
| D-40 | **Las marcas "Pagado" del Excel, en la parte 4** | Se importarán como pagos ya hechos cuando exista el modelo de pagos. |

## Bloque 7 — Parte 4: movimientos y clasificación automática (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-41 | **Pestaña Movimientos** | Nueva entrada en la navegación (solo Admin y Tesorería, D-16). Importar el Excel del banco en dos pasos: analizar (resumen: nuevos, ya importados, salidas ignoradas, cuántos se clasificarían solos y cuántos irían a Dudas) y confirmar. El fichero no se guarda. Lista con filtros Dudas / Clasificados y "Deshacer" en los clasificados, que vuelven a Dudas. Los eventos y la ficha de familia muestran lo pagado y lo que está a medias. Resolver las dudas a mano llega en la parte 5. |
| D-42 | **Las salidas del banco se ignoran** | Los importes negativos (gastos, comisiones, devoluciones) no se guardan; el resumen dice cuántos se han ignorado. Una devolución a una familia (D-5c) se apuntará a mano. |
| D-43 | **Se cuadra contra todo lo pendiente del curso** | Un pago se intenta cuadrar con los cargos pendientes o a medias de la familia en el curso activo, aunque el evento haya terminado. Cada cargo de la combinación se paga entero (lo que le falta). Si hay más de una combinación posible, va a Dudas (D-5). Los movimientos se procesan por orden de fecha. |
| D-44 | **Las marcas "Pagado" del listado crean pagos** | Sustituye a D-33 y concreta D-40. Al importar el listado se elige a qué evento corresponde cada columna con marcas; cada "Pagado" crea un pago "marcado en el listado" por lo que le falta al cargo. Si después llega del banco un pago de esa familia que ya no cuadra con nada, va a Dudas avisando de que puede estar ya marcado en el listado. |
| D-45 | **Un movimiento ya importado se reconoce por su Nº mov** | El Nº mov de Unicaja, junto con la fecha y el importe, identifica cada movimiento: se pueden subir Excel de periodos que se solapen sin duplicar nada. |
| D-46 | **El pago a mano llega en la parte 5, junto con Dudas** | Adelanta parte de la parte 6. Se apunta fecha, quién paga, importe y cómo se pagó, y en la misma pantalla se elige la familia y a qué deudas va, con el mismo reparto que se usa para resolver una duda. |
| D-47 | **Un pago a mano no se cuenta dos veces** | Al importar el banco, si ya hay un pago a mano de la misma familia y el mismo importe en fechas cercanas, el del banco va a Dudas con el aviso «¿Ya apuntado a mano?». Nunca se suma dos veces sin que lo decida el usuario. |

## Bloque 8 — Parte 5: Dudas, aprendizaje y pago a mano (2026-10-27)

| # | Decisión | Detalle |
|---|---|---|
| D-48 | **Saldo a favor: guardar, ver y aplicar** | Concreta D-5c. Lo que no se reparte de un pago queda como saldo de la familia; la pantalla lo dice antes de guardar. En la ficha de familia se ve el saldo y se puede aplicar a una deuda pendiente (se toma de los pagos más antiguos con sobrante). La propuesta al crear un evento llega más adelante. |
| D-49 | **«No es de familias»** | Un ingreso que no es de ninguna familia (subvención, donación, reintegro) sale de Dudas con una nota corta opcional y queda en el filtro «Otros ingresos». Se puede deshacer. |
| D-50 | **Recordar un pagador reintenta sus otras dudas** | Al recordar un pagador (D-1), el motor vuelve a pasar por las otras dudas de ese pagador: las que ahora cuadran sin duda se clasifican solas y la app dice cuántas. Las deshechas a mano no se tocan. |
| D-51 | **Cruce con pagos a mano y marcas, sin límite de fechas** | Concreta D-47. Al importar, si la familia tiene un pago a mano del mismo importe que no esté ya cruzado con uno del banco, el del banco va a Dudas con «¿Ya apuntado a mano?». En la duda, «Es el mismo pago» cruza los dos: el del banco se queda con el reparto y el apuntado queda ligado a él. Vale también para las marcas del listado. Deshacer lo devuelve todo como estaba. |
| D-52 | **Un pago, una familia** | Cada pago se reparte entre deudas de una sola familia (D-1). El buscador permite cambiar de familia, pero no mezclar dos. |

## Bloque 9 — Parte 6: consulta y exportación por evento (2026-10-28)

| # | Decisión | Detalle |
|---|---|---|
| D-53 | **Exportar a Excel (.xlsx)** | El estado de un evento se descarga como `.xlsx` que genera la API con SheetJS (el mismo que lee los Excel). Importes como números con formato de euros y cabecera fija. El fichero se crea al vuelo y no se guarda. |
| D-54 | **Se exporta lo filtrado, con resumen** | El Excel lleva lo que se está viendo (filtros de estado y sección): una fila por niño con nombre, apellidos, sección, importe, pagado, pendiente y estado. Arriba, el evento, el curso y el total cobrado y pendiente de esas filas. |
| D-55 | **Exporta cada uno lo que ve** | Admin y Tesorería exportan todo el evento; un Scouter, solo sus secciones (D-16), igual que en pantalla. El motivo de un ajuste nunca va en el Excel (D-35). |
| D-56 | **Pagos de cada niño en el evento** | En el detalle del evento, Admin y Tesorería pueden tocar a un niño y ver qué pagos cubren su cargo: fecha, quién pagó, cómo (banco, a mano con su medio o marca del listado) e importe. Los Scouters no lo ven. |
| D-57 | **Eventos abiertos en Inicio** | Inicio muestra los eventos del curso que siguen abiertos o tienen algo pendiente, con su % cobrado y enlace al detalle. Los Scouters ven los de sus secciones, con lo cobrado de esas secciones. |
| D-58 | **Recordatorio para copiar** | En el detalle del evento, un botón copia (o comparte en el móvil) un texto con quién falta por pagar según los filtros: nombre e inicial del primer apellido (si dos coinciden, apellidos completos), «a medias» si ha pagado parte, y sin importes. Para pegarlo en el grupo de familias; lo pueden usar todos los roles, con su visibilidad. |

## Bloque 10 — Producción y release 0.1.0 (2026-10-28)

| # | Decisión | Detalle |
|---|---|---|
| D-59 | **Droplet de 1 GB en Fráncfort, creado por el usuario** | Concreta D-10a. Basic 1 GB / 1 vCPU, Ubuntu 24.04 LTS, región FRA1, acceso solo con clave SSH. El usuario lo crea en el panel de DigitalOcean; Claude prepara `deploy/prod/` con un script de arranque que el usuario lanza una vez como root (usuario `deploy` sin `sudo`, firewall 22/80/443, actualizaciones de seguridad automáticas, Docker, nginx, Certbot y `age`). Claude no toca el servidor ni el DNS. |
| D-60 | **Despliegue a producción automático con aprobación** | Como My Money: cada merge a `master` que cambie lo desplegable construye la imagen, la publica en GHCR con su atestación de procedencia y el despliegue espera la aprobación del revisor del entorno `production` (solo admite `master`). En el servidor, la clave SSH de la CI solo puede pedir `deploy <digest> <usuario>`; el despliegue hace copia → migraciones → API nueva (vuelve sola a la anterior si no queda sana) → web. Vuelta atrás lanzando el flujo a mano con una etiqueta anterior. `pre` sigue lanzándose a mano en el servidor de casa (D-13). |
| D-61 | **El nginx del servidor solo termina TLS** | Concreta D-12 en el droplet propio: nginx + Certbot del sistema publican `scouts.josanfersal.dev` y pasan todo al contenedor web (escuchando solo en `127.0.0.1`), con límite de peticiones a `/api/auth/`. Se configura una vez en el arranque; los despliegues no lo tocan. La base de datos y la API viven en una red sin salida a Internet y sin puertos publicados. |
| D-62 | **Copias diarias cifradas con `age` y bajadas al PC** | Hay datos reales de menores: cada noche `pg_dump` cifrado con la clave pública de `age` (la privada solo está en el PC del usuario), 7 diarias y 4 semanales, otra antes de cada migración. Un script de Windows las baja a diario verificando SHA-256 y avisa si la última tiene más de 36 h. La prueba de restauración se hace en el PC, que es donde se pueden descifrar. |
| D-63 | **Arranque de producción** | Tras el primer despliegue el usuario lanza `crear-grupo` en el servidor con su email, abre el enlace de invitación, importa el listado real e invita a su equipo desde Ajustes → Personas. La release 0.1.0 (partes 0–6) es la que se prueba con el equipo y datos reales. |

## Bloque 11 — Operación de producción (2026-10-28)

| # | Decisión | Detalle |
|---|---|---|
| D-64 | **Reinicio automático de madrugada tras actualizaciones** | Completa D-59. `unattended-upgrades` reinicia el droplet solo cuando una actualización lo pide (sobre todo las del kernel), a las 04:30 UTC: después de la copia de las 03:15 y con la web casi sin uso. Reinicia aunque haya una sesión SSH abierta. Los contenedores vuelven solos (`restart: unless-stopped`) y el check de Uptime avisa si la web no vuelve. Se descartan el reinicio a mano (el kernel puede quedarse semanas sin parchear) y Livepatch (cuenta y servicio extra para un solo droplet). |
| D-65 | **Las copias se bajan al encender el PC; más adelante, desde el servidor de casa** | Completa D-62. El PC no se queda encendido siempre (gastaría decenas de euros al año solo para esto): la tarea de Windows se lanza a las 09:00 o, si el PC estaba apagado, en cuanto se enciende. Basta con encenderlo una vez por semana, porque el servidor guarda 7 copias diarias y 4 semanales y el script baja todas las que falten. Cuando el servidor de casa esté montado, la descarga diaria pasará a un cron allí (con un script en bash y su propia clave para `deploy`); la clave privada de `age` y la prueba de restauración siguen solo en el PC. |

## Bloque 12 — Parte 7: pedidos con formulario propio (2026-10-29)

| # | Decisión | Detalle |
|---|---|---|
| D-66 | **Pedidos: un tipo de evento con catálogo de artículos** | Para encargos bajo demanda (sudaderas, camisetas, pañoletas, libros…), que se repiten cada año. Un evento de tipo **Pedido** tiene artículos con precio, unidades máximas por persona (5 por defecto) y opciones que define Tesorería: **listas cerradas** (talla, color…) y **textos cortos** (nombre al dorso) con longitud máxima y solo letras, números, espacios y signos sencillos; cada opción o valor puede llevar suplemento. No hay preguntas libres: así no se pueden acabar recogiendo datos sensibles de menores (salud, alergias). Cada unidad es una línea con sus opciones. Cada persona tiene **un cargo, la suma de sus líneas**: clasificación, Dudas, pago a mano y saldo funcionan igual. Sin precio de hermanos ni recálculo por matrícula (el pedido se mantiene aunque el niño se dé de baja). Solo para educandos y scouters (dados de alta en su sección) que ya existan. Admin y Tesorería lo gestionan todo; un Scouter ve las líneas de sus secciones. Exportaciones: por persona (qué pidió, debe y pagado) y para el proveedor (unidades por artículo y opción, y los textos a estampar sin decir de quién son). |
| D-67 | **Formulario público con un enlace por pedido** | Sustituye a Google Forms. Al crear el pedido se genera un enlace aleatorio (32 bytes) que Tesorería puede copiar o cambiar cuando quiera; se guarda tal cual porque solo sirve para enviar a ese pedido. El código va **detrás del `#`** de la dirección: el navegador nunca lo manda en la petición de la página, así que no llega a registros ni se filtra a otras webs. Solo funciona con el pedido abierto (no cerrado y sin pasar la fecha de fin). El padre escribe nombre, apellidos y sección (de una lista) y elige artículos y opciones; **nunca ve el listado del grupo**. Al enviar ve un resumen con el total y las instrucciones de pago que escribe Tesorería en cada pedido. No se piden correos ni se suben ficheros (el pago se comprueba con el banco). Lleva un aviso de privacidad: responsable (el grupo), finalidad, conservación y derechos. Se descarta la importación de Google Forms. |
| D-68 | **Lo enviado se revisa antes de crear cargos** | Cada envío queda pendiente y Tesorería lo ve con el semáforo de la importación (reconocido, dudoso o sin coincidencia, con la misma búsqueda tolerante a erratas). Un segundo envío para la misma persona se marca como posible cambio del anterior. Solo al aceptarlo se crean las líneas y el cargo. Tesorería también puede apuntar líneas a mano desde el pedido. **Cerrar el pedido** (al mandarlo al proveedor) bloquea envíos y cambios de líneas, pero se sigue cobrando. |
| D-69 | **Protección del formulario sin terceros** | Límites por IP en el nginx del servidor y en la API; campo trampa oculto (un envío que lo rellena se descarta sin decir nada); un justificante firmado por la API al abrir el formulario que exige un tiempo mínimo de relleno y caduca; tamaño máximo del envío y tope de envíos pendientes por pedido. Un bot no puede crear cargos: como mucho llena la bandeja de pendientes, que tiene tope. **Se descarta Cloudflare Turnstile**: obligaría a dar salida a Internet a la API, que vive aislada (D-61), y a ampliar la CSP; si algún día hiciera falta, sería una decisión nueva. |
| D-70 | **Conservar lo mínimo y Excel seguro** | Al aceptar un envío se guardan solo sus líneas y el envío se borra; los rechazados se borran en el momento; los pendientes que nadie revise se borran solos 30 días después de cerrar o terminar el pedido. Al exportar a Excel, cualquier texto que empiece por `=`, `+`, `-`, `@`, tabulador o retorno se neutraliza para que un texto malicioso no se ejecute como fórmula al abrir el fichero. |
| D-71 | **Los pedidos son la parte 7** | La PWA, el pulido visual y la accesibilidad pasan a la parte 8. |

## Bloque 13 — Parte 8: PWA, pulido y accesibilidad (2026-10-29)

| # | Decisión | Detalle |
|---|---|---|
| D-72 | **Sin conexión, solo la app; nunca los datos** | Concreta D-6. El service worker guarda la web (HTML, JS, CSS, fuentes e iconos) para que abra al instante; las respuestas de `/api` **nunca** se guardan: en un móvil compartido o perdido no queda ningún dato de los niños. Sin conexión, la app lo dice con un aviso claro. |
| D-73 | **Versiones nuevas con aviso** | Cuando hay una versión nueva, sale un aviso «Hay una versión nueva» con un botón Actualizar. Nunca se recarga sola en mitad de algo. |
| D-74 | **Guía de instalación en Inicio y en Ajustes** | En móviles y si aún no está instalada, una tarjeta en Inicio que se puede cerrar, con los pasos de su sistema (Android: botón Instalar; iPhone: Compartir → Añadir a pantalla de inicio). Siempre disponible en Ajustes. Icono propio de la app en todos los tamaños de Android e iPhone. |
| D-75 | **Accesibilidad comprobada en los tests y a mano** | axe revisa en los tests de la web las pantallas principales y la CI falla si aparece un problema. Además, revisión a mano de cada pantalla (teclado, foco visible, lector de pantalla, contraste en claro y oscuro, tamaño de los botones en el móvil y movimiento reducido) y pulido de estados vacíos, de carga y de error. |
| D-76 | **Acabado de app en el móvil** | Completa D-75 tras revisarla con impeccable y las guías de móvil nativo y de detalles de interfaz. Sin destello al tocar, sin retraso de doble toque, sin selección de texto al mantener pulsado un control y sin «tirar para recargar». Los botones de quitar miden al menos 36 px. Los botones se hunden un poco al pulsarlos (escala 0,97). Los diálogos suben desde abajo en el móvil y aparecen con un fundido en el ordenador (unos 0,2 s); con «reducir movimiento», solo fundido y sin hundirse. La selección de texto y el cursor usan el verde del tema. Sin cambios de colores, tipografía ni estética (D-7). |

## Bloque 14 — Pruebas en el móvil y release 0.2.0 (2026-10-30)

| # | Decisión | Detalle |
|---|---|---|
| D-77 | **Probar en el móvil con un túnel puntual; `pre` no va en el droplet de producción** | Probar la PWA instalada exige HTTPS. Se descarta montar `pre` en el droplet de producción: tiene datos reales de menores, a `pre` llega código sin release y 1 GB de memoria no da para dos copias. Para pruebas concretas se abre un túnel puntual de Cloudflare (`cloudflared tunnel --url`) a la web compilada del PC, con datos inventados, y se cierra al terminar. Montar `pre` en el servidor de casa (D-13), con Cloudflare Tunnel en vez de abrir puertos, queda para cuando haya más grupos además del primero. |

## Bloque 15 — Revisión de `npm audit` (2026-10-30)

| # | Decisión | Detalle |
|---|---|---|
| D-78 | **Dependencias: se sube Zod y Vitest; Prisma y deepmerge se aceptan documentados** | **Zod 3 → 4** en la API y la web: Zod 3 podía agotar la memoria al validar listas enormes con tope. Ya lo frenaban los límites de tamaño (100 KB en la API, 32 KB en el formulario público), pero queda resuelto del todo. Los mensajes propios se mantienen; ahora también salen cuando llega un tipo equivocado, no solo cuando falta el campo. **Vitest 3 → 4.1.12** (solo desarrollo y CI): quita `tinypool` (crítica) y arregla `@vitest/mocker`. **Se acepta `deepmerge-ts`** (alta, dentro de Prisma): solo lo usa la herramienta de Prisma al leer su propia configuración y nadie de fuera puede llegar ahí; se resuelve al subir a Prisma 7, que es una migración grande y tendrá su propia rama. **Se acepta `deepmerge`** (baja, dentro de `vite-plugin-pwa`): solo se usa al compilar la web con nuestra propia configuración y no hay versión arreglada. |

## Bloque 16 — Parte 9: paso de curso (2026-10-30)

| # | Decisión | Detalle |
|---|---|---|
| D-79 | **El paso de curso propone por año de nacimiento y se revisa antes de confirmar** | Concreta D-2 y D-31. Cada sección tiene una edad máxima opcional, editable en Secciones; por defecto Castores 7, Manada 10, Tropa 13, Unidad 16 y Clan 21, y Scouters sin edad. La app propone subir a quien supere la edad máxima de su sección en el año natural en que empieza el curso nuevo (en 2027-28 dejan Castores los que cumplen 8 o más en 2027). Quien no tiene fecha de nacimiento se queda en su sección y se sube a mano. Todo se revisa antes de confirmar. |
| D-80 | **Casilla «Sigue» por niño** | Todos siguen por defecto, salvo los de la última sección que superan su edad máxima, que aparecen como «Termina». Quien no sigue no se matricula en el curso nuevo; conserva su historial, su familia y sus deudas. |
| D-81 | **El curso nuevo se activa al confirmar** | Un solo paso: se revisa, se confirma y el curso nuevo queda activo. Nada se guarda antes de confirmar. El curso anterior sigue consultable (D-2). |
| D-82 | **Las deudas de cursos anteriores también cuadran** | Modifica D-43. Un pago del banco se intenta cuadrar con todo lo pendiente o a medias de la familia, sea del curso que sea (por ejemplo, el campamento de verano pagado en septiembre). Si hay más de una combinación posible, va a Dudas (D-5). |
| D-83 | **El paso de curso es la parte 9** | Llega antes de septiembre de 2027, como pedía D-31. |
| D-84 | **Solo Admin hace el paso de curso** | En los grupos el paso de sección lo lleva Secretaría en el CRM de ámbito estatal; aquí no hay ese cargo, así que el asistente es solo para Admin. Tesorería y Scouters ven el curso nuevo cuando ya está activo. |

Los importes se guardan en céntimos (enteros), para no tener errores de redondeo.

**Nota sobre ramas:** la parte 1 sale de `pre` y no de `develop`, porque necesita el esqueleto de la parte 0, que aún
no ha llegado a `develop` (solo llega al cerrar la release).

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
