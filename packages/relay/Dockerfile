FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/relay/package.json packages/relay/package.json
RUN npm ci --workspaces --include-workspace-root=false --ignore-scripts || npm install
COPY packages/shared packages/shared
COPY packages/relay packages/relay
RUN npm run build -w packages/shared && npm run build -w packages/relay

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/packages/relay packages/relay
COPY data data
EXPOSE 4000
CMD ["node", "packages/relay/dist/server.js"]
