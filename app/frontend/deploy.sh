#!/usr/bin/env bash
# ============================================
# LLM Chat Service - Deployment Script
# ============================================
# .envrc의 환경변수를 기반으로 Helm 배포를 수행합니다.
# Gateway/VirtualService는 사용자가 직접 관리합니다.
#
# 사용법:
#   source .envrc
#   ./deploy.sh [install|upgrade|template|uninstall]
#
# ⚠️ 필수 환경변수: IMAGE_REPOSITORY, K8S_NAMESPACE
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/deployments/helm"
RELEASE_NAME="llm-chat-service"

# 필수 환경변수 검증 (기본값 없음)
: "${IMAGE_REPOSITORY:?ERROR: IMAGE_REPOSITORY is not set. Run 'source .envrc' first.}"
: "${K8S_NAMESPACE:?ERROR: K8S_NAMESPACE is not set. Run 'source .envrc' first.}"
: "${IMAGE_TAG:=latest}"
: "${REPLICA_COUNT:=1}"

HELM_SET_ARGS=(
  --set "image.repository=${IMAGE_REPOSITORY}"
  --set "image.tag=${IMAGE_TAG}"
  --set "replicaCount=${REPLICA_COUNT}"
)

ACTION="${1:-install}"

echo "============================================"
echo " LLM Chat Service Deployment"
echo "============================================"
echo " Action    : ${ACTION}"
echo " Namespace : ${K8S_NAMESPACE}"
echo " Image     : ${IMAGE_REPOSITORY}:${IMAGE_TAG}"
echo " Replicas  : ${REPLICA_COUNT}"
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