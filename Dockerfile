# TODO: Beide FROM-Statements nach erstem erfolgreichen Coolify-Build auf
# SHA256-Digest pinnen (docker inspect <image> --format '{{index .RepoDigests 0}}')
# — verhindert Drift wenn upstream :22-alpine / :1.27-alpine getagged neu wird.
FROM node:22-alpine AS build
WORKDIR /app
# pnpm direkt via npm — umgeht corepack signing-key-Bug
# (Node ≤22.13 wurde mit alten corepack keys ausgeliefert, npm-Registry rotiert)
RUN npm install -g pnpm@10.17.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# Healthcheck: nginx sollte index.html ausliefern
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
