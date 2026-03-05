#!/usr/bin/env bash
# ============================================
# LLM Chat Service - Docker Build Script
# ============================================
# .envrc의 환경변수를 기반으로 Docker 이미지를 빌드합니다.
#
# 사용법:
#   source .envrc
#   ./docker-build.sh
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${IMAGE_REPOSITORY:=llm-chat-service}"
: "${IMAGE_TAG:=latest}"
: "${VITE_LITELLM_BASE_URL:=https://openllm.net}"
: "${VITE_LITELLM_API_KEY:=}"

echo "============================================"
echo " Docker Build"
echo "============================================"
echo " Image: ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo " VITE_LITELLM_BASE_URL: ${VITE_LITELLM_BASE_URL}"
echo "============================================"

docker build \
  --build-arg "VITE_LITELLM_BASE_URL=${VITE_LITELLM_BASE_URL}" \
  --build-arg "VITE_LITELLM_API_KEY=${VITE_LITELLM_API_KEY}" \
  -t "${IMAGE_REPOSITORY}:${IMAGE_TAG}" \
  "${SCRIPT_DIR}"

echo "✅ Docker image built: ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo ""
echo "로컬 테스트:"
echo "  docker run -p 8080:8080 ${IMAGE_REPOSITORY}:${IMAGE_TAG}"