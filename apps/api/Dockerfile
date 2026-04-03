FROM node:20-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/hero-app/package.json apps/hero-app/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json

RUN npm install

COPY . .

RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN npm run build --workspace api

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["npm", "run", "start"]
