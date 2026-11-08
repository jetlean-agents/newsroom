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
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# `payload migrate`/`npm run seed` run via the Payload CLI, which loads
# payload.config.ts (and everything it imports) directly from source at
# runtime using tsconfig.json — not from the compiled .next output — so the
# full src tree has to ship in the runner image, not just the migrations dir.
COPY --from=builder /app/src ./src
# The ingestion worker (FACT-169) reads this at runtime via a plain fs.readFileSync,
# not a bundled import — without it `npm run worker` crashes on boot with ENOENT.
COPY --from=builder /app/config ./config
EXPOSE 3000
# Run pending migrations, then start the server. Seeding is a separate manual
# step (`npm run seed`), not part of every container start.
CMD ["sh", "-c", "npm run migrate && npm start"]
