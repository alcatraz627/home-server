FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
RUN mkdir -p /data/uploads
ENV PORT=3000
ENV ORIGIN=http://localhost:3000
ENV UPLOAD_DIR=/data/uploads
ENV BODY_SIZE_LIMIT=Infinity
EXPOSE 3000
CMD ["node", "build/index.js"]
