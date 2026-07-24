# --- Build stage ---
FROM node:26-slim AS build
WORKDIR /app
# better-sqlite3 needs build toolchain
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && npm install --omit=dev \
    && apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
# Drop root: the node:20-slim image ships a non-root `node` user (uid 1000).
# Runtime needs no write access to /app, so read-only ownership is fine.
RUN chown -R node:node /app
USER node
# MCP servers communicate over stdio; no port is exposed.
ENTRYPOINT ["node", "dist/index.js"]
