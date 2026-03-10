#!/usr/bin/env bash
# ============================================
# LLM Chat Service - Docker Build Script
# ============================================
# .envrc의 환경변수를 그대로 Docker build-arg로 전달합니다.
#
# 사용법:
#   source .envrc
#   ./docker-build.sh
#
# ⚠️ 필수 환경변수: VITE_LITELLM_BASE_URL, VITE_LITELLM_API_KEY, IMAGE_REPOSITORY
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 필수 환경변수 검증 (기본값 없음)
: "${VITE_LITELLM_BASE_URL:?ERROR: VITE_LITELLM_BASE_URL is not set. Run 'source .envrc' first.}"
: "${VITE_LITELLM_API_KEY:?ERROR: VITE_LITELLM_API_KEY is not set. Run 'source .envrc' first.}"
: "${IMAGE_REPOSITORY:?ERROR: IMAGE_REPOSITORY is not set. Run 'source .envrc' first.}"
: "${IMAGE_TAG:=latest}"
: "${VITE_PORT:=3000}"

echo "============================================"
echo " Docker Build"
echo "============================================"
echo " Image              : ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo " VITE_LITELLM_BASE_URL : ${VITE_LITELLM_BASE_URL}"
echo " VITE_PORT          : ${VITE_PORT}"
echo "============================================"

docker build \
  --build-arg "VITE_LITELLM_BASE_URL=${VITE_LITELLM_BASE_URL}" \
  --build-arg "VITE_LITELLM_API_KEY=${VITE_LITELLM_API_KEY}" \
  --build-arg "VITE_PORT=${VITE_PORT}" \
  -t "${IMAGE_REPOSITORY}:${IMAGE_TAG}" \
  "${SCRIPT_DIR}"

echo "✅ Docker image built: ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo ""
echo "다음 단계:"
echo "  docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo "  docker run -p 8080:8080 ${IMAGE_REPOSITORY}:${IMAGE_TAG}"