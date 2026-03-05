#!/usr/bin/env bash
# ============================================
# LLM Chat Service - Deployment Script
# ============================================
# .envrc의 환경변수를 기반으로 Helm 배포를 수행합니다.
#
# 사용법:
#   source .envrc
#   ./deploy.sh [install|upgrade|template|uninstall]
#
# 예시:
#   source .envrc && ./deploy.sh install
#   source .envrc && ./deploy.sh upgrade
#   source .envrc && ./deploy.sh template   # dry-run (매니페스트 확인용)
#   source .envrc && ./deploy.sh uninstall
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/deployments/helm-chart"
RELEASE_NAME="llm-chat-service"

# .envrc 환경변수 기본값 체크
: "${SERVICE_HOST:?ERROR: SERVICE_HOST is not set. Run 'source .envrc' first.}"
: "${SERVICE_PORT:=8080}"
: "${VITE_LITELLM_BASE_URL:=https://openllm.net}"
: "${VITE_LITELLM_API_KEY:=}"
: "${IMAGE_REPOSITORY:=llm-chat-service}"
: "${IMAGE_TAG:=latest}"
: "${K8S_NAMESPACE:=default}"
: "${ISTIO_GATEWAY_NAME:=llm-chat-gateway}"
: "${REPLICA_COUNT:=1}"

HELM_SET_ARGS=(
  --set "service.host=${SERVICE_HOST}"
  --set "service.port=${SERVICE_PORT}"
  --set "image.repository=${IMAGE_REPOSITORY}"
  --set "image.tag=${IMAGE_TAG}"
  --set "replicaCount=${REPLICA_COUNT}"
  --set "istio.gateway.name=${ISTIO_GATEWAY_NAME}"
  --set "env.VITE_LITELLM_BASE_URL=${VITE_LITELLM_BASE_URL}"
  --set "env.VITE_LITELLM_API_KEY=${VITE_LITELLM_API_KEY}"
)

ACTION="${1:-install}"

echo "============================================"
echo " LLM Chat Service Deployment"
echo "============================================"
echo " Action    : ${ACTION}"
echo " Namespace : ${K8S_NAMESPACE}"
echo " Host      : ${SERVICE_HOST}"
echo " Port      : ${SERVICE_PORT}"
echo " Image     : ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo " Gateway   : ${ISTIO_GATEWAY_NAME}"
echo "============================================"

case "${ACTION}" in
  install)
    echo "🚀 Installing ${RELEASE_NAME}..."
    helm install "${RELEASE_NAME}" "${CHART_DIR}" \
      --namespace "${K8S_NAMESPACE}" \
      --create-namespace \
      "${HELM_SET_ARGS[@]}"
    echo "✅ Installation complete!"
    ;;
  upgrade)
    echo "🔄 Upgrading ${RELEASE_NAME}..."
    helm upgrade "${RELEASE_NAME}" "${CHART_DIR}" \
      --namespace "${K8S_NAMESPACE}" \
      "${HELM_SET_ARGS[@]}"
    echo "✅ Upgrade complete!"
    ;;
  template)
    echo "📋 Rendering templates (dry-run)..."
    helm template "${RELEASE_NAME}" "${CHART_DIR}" \
      --namespace "${K8S_NAMESPACE}" \
      "${HELM_SET_ARGS[@]}"
    ;;
  uninstall)
    echo "🗑️  Uninstalling ${RELEASE_NAME}..."
    helm uninstall "${RELEASE_NAME}" --namespace "${K8S_NAMESPACE}"
    echo "✅ Uninstall complete!"
    ;;
  *)
    echo "❌ Unknown action: ${ACTION}"
    echo "Usage: $0 [install|upgrade|template|uninstall]"
    exit 1
    ;;
esac