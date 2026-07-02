# ── 빌드 스테이지: 클라이언트 + 서버 빌드 ──
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

COPY . .
RUN npm run build

# ── 실행 스테이지: 프로덕션 의존성만 포함한 경량 이미지 ──
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/client/package.json client/
COPY --from=build /app/server/package.json server/
RUN npm ci --omit=dev

COPY --from=build /app/client/dist client/dist
COPY --from=build /app/server/dist server/dist

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
