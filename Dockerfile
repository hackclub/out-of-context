FROM oven/bun:latest AS builder
WORKDIR /app

COPY package.json ./
COPY bun.lock ./
COPY patches ./patches

RUN bun install --frozen-lockfile

FROM oven/bun:latest
WORKDIR /app

COPY --from=builder /app /app
COPY tsconfig.json drizzle.config.ts index.ts ./
COPY drizzle ./drizzle
COPY src ./src

EXPOSE 8000

ENTRYPOINT [ "sh", "-c", "bunx drizzle-kit migrate && bun index.ts" ]
