# Pagos Scouts — propuesta para debatir

> Estado: **en debate**. Cada punto marcado con **[D-n]** es una decisión; la recomendación es solo un
> punto de partida para el debate.
>
> **Todas las decisiones están tomadas** (ver [decisiones.md](decisiones.md)). Este documento queda como
> registro del debate.

## 1. Lo que ya sabemos por el prototipo (`conciliar.py`)

- El Excel de Unicaja (`.xls` antiguo) solo trae **fecha, nombre del pagador e importe**. No trae el concepto
  ni el IBAN. Toda la identificación sale del nombre y del importe.
- Con el listado de educandos completo, se identificó la familia de **29 de 30 ingresos** sin falsos positivos.
- Los hermanos están repartidos entre secciones, y los padres aparecen escritos de formas distintas
  (erratas, apellidos de menos, diminutivos como "Pepa" → "Josefa").
- Los importes siguen reglas que la app tiene que poder expresar:
  - **Precio distinto para el 2º hermano** (cuota 110 € / 85 €).
  - **Pagos agrupados:** un pago para varios niños y varias actividades (279 € = 2 censos + 2 cuotas).
  - **Pagos partidos o en plazos** (152 € + 5 €; 97 € = 42 € + 55 €).
  - **Importes que no cuadran** con nada y requieren criterio humano.

## 2. Modelo de datos (propuesta)

```
Grupo ─┬─ Sección (Castores, Manada, Tropa, Unidad, Clan, Scouters)
       ├─ Ronda/Curso (2026-2027)            ← los niños cambian de sección cada curso
       ├─ Familia ─┬─ Educando ── Matrícula (educando + sección + curso)
       │           └─ Pagador (nombre tal como sale en el banco, aprendido)
       ├─ Evento (cuota, censo, acampada…) ── Precio por sección, regla de hermanos
       │     └─ Cargo (lo que debe un educando en un evento: importe, estado)
       ├─ Importación (fichero subido, quién, cuándo)
       │     └─ Movimiento (fecha, pagador, importe, nº mov.; origen banco o manual)
       └─ Asignación (movimiento → cargo, importe)   ← la pieza clave
Usuario ── Membresía (usuario + grupo + rol)
```

Ideas clave:

- **Asignación** permite las dos cosas que pediste a la vez:
  - **Un pago para varios niños:** 84 € se reparten en 42 € para cada hermano.
  - **Varios pagos para un mismo cargo:** 152 € + 5 € cubren juntos un mismo cargo.

  El estado de cada cargo (pendiente, parcial o pagado) se calcula sumando sus asignaciones.
- **Pagador → Familia [D-1].** Cuando clasificas un pago de alguien no registrado, el sistema guarda que
  "este nombre del banco paga por esta familia".
  - **Recomiendo ligarlo a la familia, no a niños concretos:** si una abuela paga por un nieto, lo normal
    es que también pague por el hermano que está en otra sección.
  - **Alternativa:** ligarlo a niños sueltos. Es más flexible, pero obliga a reasignar cada vez que entra
    un hermano nuevo.
- **Ronda/Curso [D-2].** No lo mencionaste, pero lo recomiendo: cada septiembre los niños pasan de sección
  y los eventos son del curso. Sin este concepto, en el segundo año se mezclan las cuotas de 2026 y 2027.
- **Movimientos sin duplicados:** si subes dos Excel cuyas fechas se solapan, los movimientos repetidos se
  detectan (por fecha, nº de movimiento e importe) y no se cuentan dos veces.
- **Gastos:** los movimientos negativos se guardan como "ignorados". No los borramos, para que el saldo
  cuadre si algún día queremos usarlos.
- **Secciones [D-3].** Propongo traerlas creadas por defecto con tus 6 nombres, pero que cada grupo pueda
  renombrarlas: otras asociaciones las llaman Lobatos, Rangers, Pioneros, Rutas…

## 3. Eventos y cargos

Al crear un evento se indican:

- **Datos básicos:** nombre, fechas de inicio y de fin, y a qué secciones aplica.
- **Precio por sección:** por ejemplo, un campamento puede costar distinto en Castores que en Clan.
- **Regla de hermanos (opcional):** "2º hermano y siguientes: X €".
- **Tipo [D-4]:**
  - **Obligatorio para toda la sección** (cuota, censo): se genera un cargo para cada niño matriculado.
  - **Con apuntados** (acampada, campamento): solo genera cargo para los niños que marques como asistentes.

Se puede excluir a un niño o ponerle un **importe personalizado** (becas, casos especiales). Esto
sustituye a tener que poner "Pagado" a mano en el Excel.

## 4. Motor de clasificación

Es el prototipo pasado a la app, con un paso más: además de la familia, deduce **qué cargos** cubre el pago.

1. **Identificar a la familia:** primero busca entre los pagadores ya aprendidos; si no está, compara el
   nombre con los padres del listado (como hace hoy el prototipo).
2. **Cuadrar el importe:** busca combinaciones de **cargos pendientes de esa familia** en eventos activos que
   sumen exactamente el importe del pago (por ejemplo, 279 € = censo ×2 + cuota + cuota de 2º hermano).
3. **Decidir [D-5]:**
   - **Se clasifica solo** si la familia está identificada con seguridad **y** solo hay **una** combinación
     posible.
   - **En cualquier otro caso va a "Dudas"** con la mejor sugerencia ya preseleccionada, para aceptarla con un
     clic o corregirla. Entran aquí los pagadores desconocidos, los importes que no cuadran y las
     combinaciones con varias opciones.
4. **Todo es reversible:** cualquier clasificación, automática o manual, se puede deshacer, y queda
   registrado quién hizo qué.

## 5. Pantallas

| Pantalla | Qué hace |
|---|---|
| Inicio | Resumen: dudas pendientes, eventos activos con % cobrado, últimos pagos |
| Importar movimientos | Subir el Excel de Unicaja → resumen: X clasificados solos, Y a dudas, Z gastos ignorados |
| **Dudas** | Lista de movimientos sin clasificar, con el motivo (pagador desconocido, importe que no cuadra…) |
| Detalle de una duda | Importe y pagador arriba. Debajo, los niños (con buscador) y sus cargos pendientes: marcas a quién va y cuánto, y la app comprueba que el reparto sume el total. Casilla "Recordar este pagador para esta familia" |
| Eventos | Eventos activos y pasados. Detalle: quién ha pagado, quién no y quién ha pagado a medias, filtrable por sección. Exportar a Excel |
| Pago manual | Para efectivo, Bizum en mano o pagos fuera de plazo: mismo formulario que una duda, pero el movimiento lo creas tú |
| Educandos y familias | Por sección; ficha de familia con sus niños (aunque estén en secciones distintas), pagadores conocidos e historial |
| Importar listado | El Excel de inicialización. Muestra las familias detectadas **antes** de guardar, para revisar uniones dudosas |
| Ajustes del grupo | Secciones, curso actual, usuarios y roles |

## 6. Stack (opciones)

### Front [D-6]

Lo has pedido en React. Sobre tu duda de añadirla a la pantalla de inicio: **una web React instalada como
PWA funciona bien en Android y en iPhone** para lo que necesita esta app (formularios, tablas y subir un
Excel). No usa NFC, cámara ni funciones nativas. Lo único que hay que tener en cuenta en iPhone:

- **No hay botón "Instalar":** hay que usar Compartir → "Añadir a pantalla de inicio", así que lo
  explicaríamos con una pequeña guía dentro de la app.
- **Sesión aparte:** la app instalada guarda la sesión por separado de Safari, así que hay que iniciar
  sesión una vez dentro de la app.

| Opción | A favor | En contra |
|---|---|---|
| **React + Vite (PWA)** ← recomendada | Simple, rápida, despliegue como ficheros estáticos | Hay que montar el enrutado y la PWA a mano (`vite-plugin-pwa`) |
| Expo web (como My Money) | Reutilizas lo que ya conoces | Problemas ya vividos en My Money (Expo Router, CSP con hashes) sin ninguna ventaja, porque aquí no hay app nativa |
| Next.js | Front y back en uno | Más complejo de desplegar en el VPS; no necesitamos renderizado en servidor |

### Librería de componentes [D-7]

Esta decisión define cómo se verá la app, así que conviene verla con maquetas antes de elegir.

| Opción | A favor | En contra |
|---|---|---|
| **Mantine** | Tablas, formularios, fechas y subida de archivos ya hechos; temas claro/oscuro | Su aspecto es más reconocible |
| **shadcn/ui + Tailwind** | Muy bonita y personalizable; el código de los componentes es tuyo | Más trabajo en tablas complejas |
| MUI | Muy completa | Aspecto "Google" difícil de quitar; más pesada |

### Back [D-8]

- **Recomendación:** el mismo stack que My Money (Node + TypeScript + Express + Prisma + PostgreSQL + Zod).
  Así reutilizas CI, Docker, despliegue por digest y backups.
- **Excel:** el `.xls` antiguo de Unicaja solo lo lee bien **SheetJS**, instalado desde su web oficial y no
  desde npm, porque la versión de npm está abandonada y tiene vulnerabilidades. Lo procesaría en el back y
  lo cubriría con tests usando ficheros **anonimizados**.
- **Autenticación [D-9]:** JWT como en My Money, o sesión con cookie `httpOnly`. La cookie es más segura en
  una web, porque el token no queda accesible a JavaScript.

### Repositorio e infraestructura [D-10]

- **Repositorio:** nuevo en GitHub, con el mismo flujo de ramas, protecciones, Dependabot apuntando a `pre`,
  CHANGELOG y versiones beta 0.x.
- **¿Público o privado?** Si va al currículum, público tiene sentido. Pero **nunca** debe llevar Excels
  reales: los tests usarán datos inventados.
- **Dónde alojarlo:** el droplet de My Money tiene 1 GB y ya aloja travel_agency y My Money. Meter otro
  Postgres puede quedarse corto. Las opciones son compartir instancia de Postgres (con bases separadas),
  ampliar el droplet o usar otro VPS. Además, `pre` iría en tu servidor de casa, como en My Money.

## 7. Multi-grupo y protección de datos [D-11]

Que haya **varios grupos registrados** cambia el papel legal de quien aloja la app:

- **Encargado del tratamiento:** quien aloja la app pasa a serlo de cada grupo, lo que obliga a firmar un
  contrato de encargo con cada uno.
- **Ubicación del servidor:** en la UE (DigitalOcean Fráncfort o Ámsterdam).
- **Backups:** cifrados.
- **Derechos de cada grupo:** borrar y exportar todos sus datos.

Propuesta:

- **El modelo de datos se diseña multi-grupo desde el principio:** todo cuelga de `Grupo` y cada consulta se
  filtra por grupo, con tests que lo comprueben.
- **Al principio solo existiría tu grupo:** el registro estaría cerrado y los grupos se darían de alta a
  mano. El resto de grupos se abriría más adelante, con la parte legal resuelta.

Roles por grupo (propuesta): **Administrador** (todo), **Tesorería** (todo menos usuarios) y **Scouter**
(solo consulta de su sección). ¿Se queda corto o sobra alguno?

## 8. Entregas por partes

Cada parte va en su `feature/*`, la pruebas aislada en `pre` y, cuando un bloque está listo, sale una
`release/x.y.z`.

| # | Parte | Qué puedes probar al terminarla |
|---|---|---|
| 0 | Esqueleto: repositorio, CI, Docker, `pre` desplegado | La web abre en `pre`; CI en verde |
| 1 | Grupos, usuarios, roles y secciones | Entrar, cambiar de grupo, gestionar secciones |
| 2 | Educandos, familias y curso + importar listado | Subir tu Excel de educandos y revisar las familias detectadas |
| 3 | Eventos y cargos | Crear "Cuota 2026-27" para unas secciones y ver quién debe qué |
| 4 | Importar movimientos + clasificación automática | Subir el Excel de Unicaja y ver qué se clasifica solo |
| 5 | Dudas + clasificación manual + aprendizaje | Resolver dudas, repartir un pago entre hermanos, ver que se recuerda |
| 6 | Pago manual + consulta y exportación por evento | Apuntar un pago en efectivo; exportar el estado de un evento |
| 7 | PWA, pulido visual y accesibilidad | Instalarla en Android y en iPhone |

**Release 0.1.0** = partes 0–6 (lo mínimo útil). La parte 7 puede ir en la 0.2.0.

## 9. Diagrama para el currículum

Un diagrama de flujo y funcionamiento: **Excel del banco → clasificación → dudas → aprendizaje → estado por
evento**, más la arquitectura (front, API, base de datos, CI/CD, VPS). Propongo hacerlo **cuando cerremos
las decisiones de stack**, para que no muestre algo que luego cambie. Se publicaría como página web para
poder enlazarlo desde el CV.
