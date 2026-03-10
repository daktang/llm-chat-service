# ---- Stage 1: Build ----
FROM domain.net/docker.io/library/node:20-alpine AS builder

WORKDIR /app

COPY .npmrc /root/.npmrc
COPY package.json package-lock.json ./

# Copy source code
COPY . .

# Build args for environment variables
ARG VITE_LITELLM_BASE_URL
ARG VITE_LITELLM_API_KEY
ARG VITE_PORT

ENV VITE_LITELLM_BASE_URL=$VITE_LITELLM_BASE_URL
ENV VITE_LITELLM_API_KEY=$VITE_LITELLM_API_KEY
ENV VITE_PORT=$VITE_PORT

RUN npm install
RUN npm run build

# ---- Stage 2: Serve ----
FROM domain.net/docker.io/library/nginx:1.25-alpine AS production

# Copy custom nginx config (port 8080 fixed)
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]