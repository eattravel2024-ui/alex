FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca --mount=type=secret,id=https_proxy,env=HTTPS_PROXY if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    if [ -n "$HTTPS_PROXY" ]; then export npm_config_https_proxy="$HTTPS_PROXY"; fi; \
    npm ci --fetch-timeout=30000 --fetch-retries=1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /var/lib/health-association/media && chown node:node /var/lib/health-association/media
USER node
EXPOSE 3000
CMD ["node", "server.js"]
