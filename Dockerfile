FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL is only needed so Payload can boot during `next build`'s page-data
# collection step; the frontend/DB-backed routes are force-dynamic so no real
# schema access happens at build time.
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/src/sql ./src/sql
COPY --from=builder /app/src/seed ./src/seed
EXPOSE 3000
# Run pending migrations, then start the server. Seeding is a separate manual
# step (`npm run seed`), not part of every container start.
CMD ["sh", "-c", "npm run migrate && npm start"]
