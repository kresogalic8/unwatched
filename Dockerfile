# Unwatched server. One long-lived process: the town's clock, the API, and the WebSocket streams.
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/engine/package.json packages/engine/
COPY packages/cognition/package.json packages/cognition/
COPY packages/store/package.json packages/store/
COPY packages/agent-sdk/package.json packages/agent-sdk/
COPY apps/server/package.json apps/server/
COPY apps/headless/package.json apps/headless/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @unwatched/server... --prod=false

FROM base AS run
ARG RELEASE_VERSION=dev
ARG COMMIT_SHA=local
ENV RELEASE_VERSION=$RELEASE_VERSION COMMIT_SHA=$COMMIT_SHA
ENV NODE_ENV=production
COPY --from=deps /app /app
COPY packages ./packages
COPY apps/server ./apps/server
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
# tsx runs the TypeScript directly; the workspace packages are source-only.
WORKDIR /app/apps/server
# node runs directly so the platform's SIGTERM reaches the town and it writes its record before it stops
CMD ["node", "--import", "tsx", "src/main.ts"]
