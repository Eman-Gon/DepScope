# syntax=docker/dockerfile:1

FROM node:22-slim AS frontend-build
WORKDIR /app/Frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

FROM node:22-slim AS backend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY --from=frontend-build /app/Frontend/dist ./Frontend/dist

EXPOSE 3000
CMD ["node", "src/server.js"]
