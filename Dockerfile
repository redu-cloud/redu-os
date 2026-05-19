# Build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files
COPY . .

# Build app
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy build output and necessary assets
COPY --from=builder /usr/src/app/.next .next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/next.config.js ./next.config.js
COPY --from=builder /usr/src/app/tailwind.config.js ./tailwind.config.js
COPY --from=builder /usr/src/app/postcss.config.js ./postcss.config.js
COPY --from=builder /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=builder /usr/src/app/next-env.d.ts ./next-env.d.ts
COPY --from=builder /usr/src/app/app ./app
COPY --from=builder /usr/src/app/components ./components
COPY --from=builder /usr/src/app/lib ./lib
COPY --from=builder /usr/src/app/types.ts ./types.ts

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
