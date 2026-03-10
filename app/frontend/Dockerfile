# ============================================
# LLM Chat Service - Dockerfile
# ============================================
# 멀티스테이지 빌드: Node(빌드) → Nginx(서빙, 포트 8080)
#
# ⚠️ 빌드 시 반드시 --build-arg로 환경변수를 전달해야 합니다.
#    VITE_* 환경변수는 빌드 시점에 번들에 포함되므로,
#    값을 변경하려면 이미지를 다시 빌드해야 합니다.
#
# 빌드 예시:
#   docker build \
#     --build-arg VITE_LITELLM_BASE_URL="https://openllm.your-domain.net" \
#     --build-arg VITE_LITELLM_API_KEY="sk-your-key" \
#     -t your-registry/llm-chat-service:latest .
#
# 실행 예시:
#   docker run -d -p 8080:8080 your-registry/llm-chat-service:latest
# ============================================

# ---- Stage 1: Build ----
FROM domain.net/docker.io/library/node:20-alpine AS builder

WORKDIR /app

# .npmrc이 있으면 내부 레지스트리 설정 적용
COPY .npmrc /root/.npmrc
COPY package.json package-lock.json ./

# 소스 코드 복사
COPY . .

# ⚠️ 필수 build-arg: 이 값들이 Vite 빌드 시 번들에 포함됩니다.
# --build-arg VITE_LITELLM_BASE_URL="https://..."
# --build-arg VITE_LITELLM_API_KEY="sk-..."
# --build-arg VITE_PORT="3000"  (선택, 빌드에는 영향 없음)
ARG VITE_LITELLM_BASE_URL
ARG VITE_LITELLM_API_KEY
ARG VITE_PORT=3000

ENV VITE_LITELLM_BASE_URL=$VITE_LITELLM_BASE_URL
ENV VITE_LITELLM_API_KEY=$VITE_LITELLM_API_KEY
ENV VITE_PORT=$VITE_PORT

RUN npm install
RUN npm run build

# ---- Stage 2: Serve ----
FROM domain.net/docker.io/library/nginx:1.25-alpine AS production

# Nginx 설정: 포트 8080, SPA fallback, 정적 파일 캐싱, gzip
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

# 빌드된 정적 파일 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]