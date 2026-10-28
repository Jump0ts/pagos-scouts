# syntax=docker/dockerfile:1
#
# Imagen de Pagos Scouts (D-12): lleva la API y, dentro de /opt/deploy, la web ya compilada y la config del nginx
# que la sirve. Una sola imagen, un solo digest: API y web siempre en la misma version.
# Contexto de construccion: la RAIZ del repositorio (el package-lock.json de los workspaces vive ahi):
#   docker build -f backend/Dockerfile -t pagos-scouts .

# ---- build: dependencias completas, cliente de Prisma y TypeScript compilado ----
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY apps/web/package.json apps/web/
# npm ci respeta el lockfile al pie de la letra; solo corren los scripts de install permitidos en allowScripts.
RUN npm ci --workspace=backend
COPY backend/ backend/
WORKDIR /app/backend
RUN npx prisma generate && npm run build

# ---- web: compilacion de la web con Vite ----
# Imagen glibc (no alpine), el mismo entorno que la CI de la web. Aqui nada llega al runtime salvo el resultado.
FROM node:24-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=apps/web
COPY apps/web/ apps/web/
WORKDIR /app/apps/web
RUN npm run build

# ---- runtime: solo dependencias de produccion (incluye la CLI de Prisma para migrate deploy) ----
FROM node:24-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=backend --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
# La web (se sirve de solo lectura desde el contenedor nginx) y la config de ese nginx. No contienen secretos.
COPY --from=web /app/apps/web/dist /opt/deploy/web/
COPY deploy/web-nginx/ /opt/deploy/web-nginx/
# Lo que el servidor de produccion extrae de esta imagen verificada para desplegarla (D-60): compose, deploy.sh,
# copias de seguridad y el comando forzado de la CI. Sin secretos.
COPY deploy/prod/ /opt/deploy/

WORKDIR /app/backend
# Sin root: si alguien explotara la API no tendria privilegios dentro del contenedor.
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
