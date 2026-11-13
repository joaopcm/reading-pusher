FROM oven/bun:1.4.4-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile
COPY src ./src
USER bun
HEALTHCHECK --interval=60s --start-period=120s CMD ["bun", "src/health.ts"]
CMD ["bun", "src/main.ts"]
