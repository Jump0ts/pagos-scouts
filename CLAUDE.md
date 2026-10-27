# Pagos Scouts — contexto del proyecto

Web de tesorería para grupos scout: cruza el Excel de movimientos del banco con educandos y eventos de pago,
clasifica sola los pagos sin duda y deja el resto en una bandeja de **Dudas**. Ver [README.md](README.md) y,
sobre todo, el registro de decisiones en [docs/decisiones.md](docs/decisiones.md): **es la fuente de verdad**.

## Reglas fijas

- **Ninguna decisión de diseño, técnica o de stack sin consultarla antes con el usuario.** Se proponen opciones
  con una recomendación, se debaten y se apuntan en `docs/decisiones.md` como una entrada nueva (D-n). Nunca se
  borra una decisión antigua: se añade otra que la sustituye.
- **La interfaz debe ser siempre intuitiva y bonita.** Diseño propio con Tailwind (D-7) a partir de la maqueta de
  referencia; las piezas complejas usan Radix Primitives sin estilos (D-7b).
- **Datos reales nunca en el repo, que es público.** Los tests y los ejemplos usan solo datos inventados en
  `tests/fixtures/`. El `.gitignore` bloquea `*.xls`, `*.xlsx` y `*.csv`; no se fuerza nunca su subida.
- **Aislamiento por grupo.** Todo dato cuelga de `Grupo` y cada consulta se filtra por el grupo de la sesión, con
  tests que lo comprueban (D-11). Datos de menores: mínimos y solo los necesarios.
- **Entregas por partes** (ver `docs/01-propuesta-para-debatir.md`, sección 8): cada parte se prueba aislada
  en `pre` antes de juntarse en una release.

## Stack

- **Web** (`apps/web`): React + Vite + TypeScript, Tailwind CSS v4, Radix Primitives, PWA (`vite-plugin-pwa`).
- **API** (`backend`): Node.js + TypeScript + Express + Prisma + PostgreSQL + Zod. Excel con SheetJS desde
  `cdn.sheetjs.com` (nunca el paquete `xlsx` de npm).
- **Sesión**: cookie `httpOnly` con sesiones en PostgreSQL (D-9). Web y API en el mismo dominio, API bajo `/api`.
- **Servir** (D-12): una imagen lleva la API y la web compilada; un contenedor nginx sin root sirve la web y pasa
  `/api` a la API. El nginx del servidor solo termina TLS.
- **Infra**: producción en un droplet propio en la UE; `pre` en el servidor doméstico con datos inventados.
  Dominios `scouts.josanfersal.dev` y `pre-scouts.josanfersal.dev` (DNS en Cloudflare, solo DNS).

## Arquitectura de código

Por **dominio** (grupos, secciones, educandos, eventos, movimientos, clasificación…), igual que My Money:

- **Backend** (`backend/src/modules/<dominio>/`): `*.routes.ts`, `*.schema.ts` (Zod), `*.types.ts` y
  `*.utils.ts` si hace falta. Utilidades genéricas en `backend/src/utils/`.
- **Web** (`apps/web/src/features/<dominio>/`): tipos, constantes, hooks y componentes del dominio. Componentes
  genéricos de interfaz en `apps/web/src/components/`, utilidades genéricas en `apps/web/src/utils/`.
- **Regla de propiedad compartida**: un tipo o constante que usan dos dominios vive en el dominio "dueño" del
  concepto y el resto lo importa de ahí. Nunca se duplica.
- **Funciones**: arrow functions por defecto (`const fn = () => {}`), salvo razón técnica concreta.
- **Estilos**: clases de Tailwind con los tokens del tema (`apps/web/src/styles/`); nada de colores sueltos.

## Flujo de ramas (Git)

| Rama | Entorno | Descripción |
|---|---|---|
| `master` | PRO | Lo que está en producción. |
| `develop` | — | Punto de partida de nuevas features; su contenido siempre = `master` (se sincroniza al cerrar cada release). |
| `feature/*` | PRE | Sale de `develop`. Una parte o una corrección. Se mergea a `pre` vía PR. |
| `pre` | PRE | Las partes de la fase en curso, juntas, en pruebas. |
| `release/x.y.z` | — | Se crea desde `pre` al cerrar una fase. El usuario la prueba; al confirmarla se mergea a `master` **y** a `develop`. |
| `hotfix/*` | — | Sale de `master` para arreglos urgentes; se mergea a `master` y a `develop`. |

- Nunca push directo a `master`, `develop`, `pre` o `release/*`: todo vía Pull Request.
- El usuario da el OK explícito antes de mergear un PR. No usar auto-merge salvo que lo pida.
- Cada entorno tiene su propia base de datos.

## CI

En cada PR: lint + typecheck + build + tests + cobertura visible en el PR, y la imagen Docker construida y
arrancada con las restricciones de producción.

## Convenciones de trabajo con Claude Code

- Idioma con el usuario: español.
- No hacer merge ni cerrar fases sin confirmación explícita.
- Antes de tocar infraestructura real (servidor doméstico, droplet, DNS, certificados) confirmar con el usuario.
  Ningún secreto en el repo ni en el chat: se generan y quedan solo en el servidor.
