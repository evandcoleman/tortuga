# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm drizzle-kit generate || true
RUN pnpm build

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini sqlite
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CONFIG_PATH=/config/tortuga.yml \
    DATABASE_URL=file:/config/tortuga.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3000
VOLUME ["/config"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
