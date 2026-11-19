# ============================================================================
# Imagen de la web (Trabajo Final, Fase 5). Se construye desde la RAIZ del
# repositorio (contexto "."), porque la web es un workspace del monorepo:
#
#   docker build -f clients/web/Dockerfile -t ecommerce-web .
#
# Etapa 1: node:22-alpine instala SOLO las dependencias de la web y compila.
# Etapa 2: nginx sin privilegios sirve dist/ y hace de proxy de /api.
#
# MODO_VITE=production (por defecto) oculta los controles de la pasarela
# simulada (hallazgo U-08); MODO_VITE=pruebas los muestra.
# ============================================================================
FROM node:22-alpine AS compilacion
WORKDIR /app

COPY package.json package-lock.json ./
COPY clients/web/package.json ./clients/web/
RUN npm ci --workspace=@ecommerce/web --include-workspace-root=false --ignore-scripts --no-audit --no-fund

COPY clients/web ./clients/web
ARG MODO_VITE=production
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --workspace=@ecommerce/web -- --mode ${MODO_VITE}

# nginx-unprivileged corre como usuario sin privilegios y escucha en 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY clients/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY clients/web/cabeceras-seguridad.conf /etc/nginx/cabeceras-seguridad.conf
COPY --from=compilacion /app/clients/web/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
