# Pagos Scouts

Web para la tesorería de grupos scout: cruza los movimientos que se descargan del banco con los educandos y
los eventos de pago (cuotas, censo, acampadas…), marca quién ha pagado qué y deja en una bandeja de **Dudas**
solo los pagos que necesitan una decisión humana. Aprende de cada decisión: la próxima vez que pague esa
persona, el pago se reconoce solo.

> **Estado:** en construcción (parte 0, el esqueleto). Todavía no hay funcionalidades.

## Cómo funciona

1. El grupo se organiza en **secciones** (Castores, Manada, Tropa, Unidad, Clan, Scouters) y **cursos**. Los
   hermanos pueden estar en secciones distintas y forman una **familia**.
2. Tesorería crea **eventos** (cuota anual, censo, acampadas) con el precio de cada sección y, si hace falta,
   el de 2º hermano. Cada niño que debe pagar recibe un **cargo**.
3. Se sube el **Excel de movimientos** del banco. El motor de clasificación identifica a la familia por el
   nombre de quien paga y busca qué cargos pendientes suman exactamente ese importe.
4. Solo se clasifica automáticamente cuando no hay ninguna duda. Todo lo demás va a **Dudas**, con una
   sugerencia lista para confirmar; al resolverla, la app recuerda al pagador.

Todas las decisiones de diseño están en [docs/decisiones.md](docs/decisiones.md).

## Stack

| Parte | Tecnología |
|---|---|
| Web | React + Vite + TypeScript, Tailwind CSS con diseño propio, Radix Primitives; instalable como PWA |
| API | Node.js + TypeScript + Express + Prisma + PostgreSQL + Zod |
| Sesión | Cookie `httpOnly` con sesiones en PostgreSQL |
| Despliegue | Una imagen Docker (API + web servida por nginx sin root), publicada en GHCR y desplegada por digest |
| CI | GitHub Actions: lint, tipos, build, tests y cobertura en cada pull request |

## Estructura

```
apps/web/      Web (React)
backend/       API (Express + Prisma)
deploy/        Despliegue: pre (servidor doméstico) y producción (VPS)
docs/          Propuesta y registro de decisiones
prototipo/     Prototipo en Python que validó la idea (conciliar.py)
```

## Desarrollo

Requiere Node 24 (ver `.nvmrc`) y PostgreSQL 16.

```bash
npm install
npm run backend:dev
npm run web:dev
```

## Privacidad

La app maneja datos de menores y movimientos bancarios. Este repositorio es público, así que **nunca**
contiene datos reales: los tests usan datos inventados y el `.gitignore` bloquea los Excels y CSV.

## Licencia

[MIT](LICENSE)
