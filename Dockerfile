# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global pnpm@11.8.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps apps
COPY packages packages

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @trachex/dashboard build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TRACHEX_HOME=/data/trachex
ENV TRACHEX_DASHBOARD_HOST=0.0.0.0
ENV TRACHEX_DASHBOARD_PORT=8000

RUN npm install --global pnpm@11.8.0 \
  && mkdir -p /data/trachex \
  && chown -R node:node /data/trachex

WORKDIR /app
COPY --from=build --chown=node:node /app ./

USER node
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@trachex/api", "dev"]
