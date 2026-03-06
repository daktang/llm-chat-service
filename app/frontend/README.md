# ✨ LLM Chat Service

LiteLLM API를 활용한 LLM 채팅 서비스입니다. React + Vite + shadcn/ui 기반의 프론트엔드로 구성되어 있으며, Kubernetes + Istio 환경에서의 배포를 지원합니다.

---

## 📋 목차

- [Quick Start (빠른 시작)](#quick-start-빠른-시작)
- [프로젝트 구조](#프로젝트-구조)
- [환경변수 관리](#환경변수-관리)
- [로컬 개발 (Local Development)](#로컬-개발-local-development)
- [지원 API 엔드포인트](#지원-api-엔드포인트)
- [Docker 이미지 빌드](#docker-이미지-빌드)
- [Kubernetes 배포 (Helm + Istio)](#kubernetes-배포-helm--istio)
- [배포 스크립트 사용법](#배포-스크립트-사용법)
- [환경변수 주입 흐름](#환경변수-주입-흐름)
- [에러 처리 및 재시도](#에러-처리-및-재시도)
- [트러블슈팅](#트러블슈팅)

---

## Quick Start (빠른 시작)

### 로컬에서 바로 실행하기

```bash
# 1. 환경변수 설정
cp .envrc.sample .envrc
vi .envrc    # VITE_LITELLM_BASE_URL, VITE_LITELLM_API_KEY 수정
source .envrc

# 2. 의존성 설치 및 실행
pnpm install
pnpm run dev

# 3. 브라우저에서 접속
open http://localhost:3000
```

### Kubernetes에 배포하기

```bash
# 1. 환경변수 설정
cp .envrc.sample .envrc
vi .envrc    # 모든 변수를 환경에 맞게 수정
source .envrc

# 2. Docker 이미지 빌드 & Push
./docker-build.sh
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}

# 3. Helm으로 배포
./deploy.sh install

# 4. 접속 확인
kubectl port-forward svc/llm-chat-service 8080:8080 -n ${K8S_NAMESPACE}
open http://localhost:8080
```

---

## 프로젝트 구조

```
.
├── .envrc                  # 환경변수 중앙 관리 (gitignore 대상)
├── .envrc.sample           # 환경변수 샘플 (신규 개발자용)
├── Dockerfile              # 멀티스테이지 Docker 빌드 (nginx:8080)
├── deploy.sh               # Helm 배포 스크립트
├── docker-build.sh         # Docker 이미지 빌드 스크립트
├── README.md
├── package.json
├── vite.config.ts
├── index.html
├── deployments/
│   └── helm/               # Helm Chart
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── configmap.yaml
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── gateway.yaml          # Istio Gateway
│           └── virtualservice.yaml   # Istio VirtualService
├── src/                    # 애플리케이션 소스코드
│   ├── components/         # React 컴포넌트
│   │   ├── ChatWindow.tsx  # 메인 채팅 윈도우
│   │   ├── ChatInput.tsx   # 메시지 입력
│   │   ├── ChatMessage.tsx # 메시지 표시
│   │   └── ModelSelector.tsx # 모델 선택
│   ├── context/            # React Context
│   │   └── ChatContext.tsx  # 채팅 상태 관리
│   ├── hooks/              # Custom Hooks
│   │   └── useChat.ts      # 채팅 Context Hook
│   ├── lib/                # API 클라이언트, 설정, 유틸리티
│   │   ├── api.ts          # API 클라이언트 (재시도, 로깅 포함)
│   │   └── config.ts       # 환경변수 기반 설정
│   ├── pages/              # 페이지 컴포넌트
│   │   ├── Index.tsx       # 메인 페이지
│   │   └── NotFound.tsx    # 404 페이지
│   ├── App.tsx
│   └── main.tsx
└── public/                 # 정적 파일
```

---

## 환경변수 관리

모든 서비스 설정은 **`.envrc` 하나로 중앙 관리**합니다. 설정 변경이 필요할 때는 `.envrc`만 수정하면 로컬 개발, Docker 빌드, Helm 배포 모두에 반영됩니다.

### 초기 설정

```bash
# 1. 샘플 파일을 복사하여 .envrc 생성
cp .envrc.sample .envrc

# 2. 환경에 맞게 값 수정
vi .envrc

# 3. 환경변수 적용
direnv allow    # direnv 사용 시
# 또는
source .envrc   # 수동 적용
```

### 환경변수 목록

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `SERVICE_HOST` | 서비스 호스트 (Istio GW/VS 라우팅용) | `llm-chat.internal.example.com` |
| `SERVICE_PORT` | 서비스 포트 (항상 8080 고정) | `8080` |
| `VITE_LITELLM_BASE_URL` | LiteLLM API 엔드포인트 | `https://openllm.net` |
| `VITE_LITELLM_API_KEY` | LiteLLM API 인증 키 | - |
| `IMAGE_REPOSITORY` | Docker 이미지 레포지토리 | `llm-chat-service` |
| `IMAGE_TAG` | Docker 이미지 태그 | `latest` |
| `K8S_NAMESPACE` | Kubernetes 네임스페이스 | `default` |
| `ISTIO_GATEWAY_NAME` | Istio Gateway 이름 | `llm-chat-gateway` |
| `REPLICA_COUNT` | Pod 복제 수 | `1` |

---

## 로컬 개발 (Local Development)

### 사전 요구사항

- Node.js 20+
- pnpm

### Step 1: 환경변수 설정

```bash
cp .envrc.sample .envrc
vi .envrc    # VITE_LITELLM_BASE_URL, VITE_LITELLM_API_KEY 수정
source .envrc
```

### Step 2: 의존성 설치

```bash
pnpm install
```

### Step 3: 개발 서버 실행

```bash
pnpm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다.

### Step 4: 빌드 및 검증

```bash
# Lint 검사
pnpm run lint

# 프로덕션 빌드
pnpm run build
```

빌드 결과물은 `dist/` 디렉토리에 생성됩니다.

### API 프록시 & 서버 터미널 로그

개발 환경에서는 모든 LLM API 요청이 **Vite 프록시**를 통해 라우팅됩니다:

```
브라우저 → /llm/v1/* → Vite Proxy → VITE_LITELLM_BASE_URL/v1/*
```

이를 통해 **서버 터미널(System IO)**에 모든 Request/Response 로그가 자동으로 출력됩니다:

```
════════════════════════════════════════════════════════════
📤 [REQUEST] 2026-03-05T10:30:00.000Z
────────────────────────────────────────────────────────────
  Method : POST
  Path   : /v1/chat/completions
  Host   : openllm.net
  Auth   : Bearer sk-xxxx...
  Body   : { "model": "gpt-oss-120b", "messages": [...] }
════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════
📥 [RESPONSE] 2026-03-05T10:30:05.000Z
────────────────────────────────────────────────────────────
  Status : 200 OK
  Path   : /llm/v1/chat/completions
  Body   : { "id": "chatcmpl-xxx", "choices": [...] }
════════════════════════════════════════════════════════════
```

> **참고**: 프로덕션 빌드에서는 프록시 없이 `VITE_LITELLM_BASE_URL`로 직접 요청합니다.

---

## 지원 API 엔드포인트

OpenAI-compatible API 엔드포인트를 지원합니다:

| 메서드 | 엔드포인트 | 설명 | 타임아웃 |
|--------|-----------|------|---------|
| `GET` | `/v1/models` | 사용 가능한 모델 목록 조회 | 60초 |
| `GET` | `/v1/models/{model_id}` | 특정 모델 상세 정보 조회 | 60초 |
| `POST` | `/v1/chat/completions` | 채팅 메시지 전송 및 AI 응답 | 120초 |
| `POST` | `/v1/completions` | 텍스트 완성 (Text Completion) | 120초 |
| `POST` | `/v1/embeddings` | 텍스트 벡터 임베딩 변환 | 60초 |
| `GET` | `/v1/models` (healthCheck) | 서버 연결 상태 확인 | 10초 |

### API 사용 예시 (코드)

```typescript
import {
  fetchModels,
  fetchModelDetail,
  sendChatMessage,
  sendCompletion,
  createEmbedding,
  healthCheck,
} from "@/lib/api";

// 모델 목록 조회
const models = await fetchModels();

// 모델 상세 정보
const detail = await fetchModelDetail("gpt-oss-120b");

// 채팅 (옵션 포함)
const chatResponse = await sendChatMessage("gpt-oss-120b", [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
], { temperature: 0.7, max_tokens: 1024 });

// 텍스트 완성
const completion = await sendCompletion("gpt-oss-120b", "Once upon a time", {
  max_tokens: 256,
  temperature: 0.9,
});

// 임베딩
const embedding = await createEmbedding("text-embedding-model", "Hello world");

// 서버 상태 확인
const health = await healthCheck();
console.log(health.ok ? "서버 정상" : `서버 오류: ${health.error}`);
```

---

## Docker 이미지 빌드

### 사전 요구사항

- Docker

### 빌드 방법

```bash
# 1. 환경변수 적용
source .envrc

# 2. Docker 이미지 빌드
./docker-build.sh
```

이 스크립트는 `.envrc`의 환경변수를 사용하여:
- `VITE_LITELLM_BASE_URL`, `VITE_LITELLM_API_KEY`를 빌드 인자로 전달
- `IMAGE_REPOSITORY:IMAGE_TAG`로 이미지 태깅
- 멀티스테이지 빌드: Node.js로 빌드 → nginx로 서빙
- nginx가 **포트 8080**에서 서비스

### 로컬에서 Docker 컨테이너 테스트

```bash
# 컨테이너 실행
docker run -d --name llm-chat -p 8080:8080 ${IMAGE_REPOSITORY}:${IMAGE_TAG}

# 접속 확인
curl http://localhost:8080

# 로그 확인
docker logs llm-chat

# 컨테이너 중지 및 삭제
docker stop llm-chat && docker rm llm-chat
```

### 이미지 레지스트리에 Push

```bash
# Private Registry
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}

# Harbor 예시
docker tag ${IMAGE_REPOSITORY}:${IMAGE_TAG} harbor.example.com/project/${IMAGE_REPOSITORY}:${IMAGE_TAG}
docker push harbor.example.com/project/${IMAGE_REPOSITORY}:${IMAGE_TAG}
```

---

## Kubernetes 배포 (Helm + Istio)

### 사전 요구사항

- Kubernetes 클러스터 (v1.24+)
- Helm 3+
- Istio (istioctl 설치 및 클러스터에 배포 완료)
- Docker (이미지 빌드용)
- kubectl (클러스터 접근 설정 완료)

### Step 1: 환경변수 설정

```bash
cp .envrc.sample .envrc
vi .envrc    # 모든 변수를 환경에 맞게 수정
source .envrc
```

**주요 설정 항목:**

```bash
# 서비스 도메인 (Istio 라우팅에 사용)
export SERVICE_HOST="llm-chat.internal.example.com"

# Docker 이미지 (레지스트리 포함 전체 경로)
export IMAGE_REPOSITORY="harbor.example.com/project/llm-chat-service"
export IMAGE_TAG="v1.0.0"

# Kubernetes 네임스페이스
export K8S_NAMESPACE="llm-chat"

# LiteLLM API 설정
export VITE_LITELLM_BASE_URL="https://your-litellm-server.com"
export VITE_LITELLM_API_KEY="sk-your-api-key"
```

### Step 2: 네임스페이스 생성 (최초 1회)

```bash
# 네임스페이스 생성
kubectl create namespace ${K8S_NAMESPACE}

# Istio 사이드카 자동 주입 활성화
kubectl label namespace ${K8S_NAMESPACE} istio-injection=enabled
```

### Step 3: Docker 이미지 빌드 & Push

```bash
# 이미지 빌드
./docker-build.sh

# 레지스트리에 Push
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}
```

### Step 4: Helm 배포

```bash
# 매니페스트 확인 (dry-run) - 실제 배포 전 리소스 확인
./deploy.sh template

# 최초 설치
./deploy.sh install

# 설치 확인
kubectl get pods -n ${K8S_NAMESPACE}
kubectl get svc -n ${K8S_NAMESPACE}
```

### Step 5: 접속 확인

#### Port Forwarding (개발/테스트용)

```bash
# Service로 직접 포트포워딩
kubectl port-forward svc/llm-chat-service 8080:8080 -n ${K8S_NAMESPACE}

# 브라우저에서 접속
open http://localhost:8080
```

#### Istio IngressGateway를 통한 접속 (프로덕션)

```bash
# 1. Istio IngressGateway의 External IP 확인
kubectl get svc istio-ingressgateway -n istio-system

# 2. DNS 또는 /etc/hosts에 도메인 매핑
# <EXTERNAL_IP>  llm-chat.internal.example.com

# 3. 접속 확인
curl -v http://${SERVICE_HOST}

# 4. Gateway 및 VirtualService 상태 확인
kubectl get gateway -n ${K8S_NAMESPACE}
kubectl get virtualservice -n ${K8S_NAMESPACE}
```

### Step 6: 업데이트 배포

```bash
# 코드 변경 후 이미지 재빌드
export IMAGE_TAG="v1.1.0"
./docker-build.sh
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}

# Helm 업그레이드
./deploy.sh upgrade

# 롤아웃 상태 확인
kubectl rollout status deployment/llm-chat-service -n ${K8S_NAMESPACE}
```

### 기존 공유 Gateway 사용

이미 클러스터에 공유 Istio Gateway가 있다면:

```bash
helm install llm-chat ./deployments/helm \
  --namespace ${K8S_NAMESPACE} \
  --set service.host=${SERVICE_HOST} \
  --set service.port=${SERVICE_PORT} \
  --set istio.gateway.existingGateway="istio-system/my-shared-gateway"
```

### 배포 삭제

```bash
# Helm 릴리스 삭제
./deploy.sh uninstall

# 네임스페이스 삭제 (선택)
kubectl delete namespace ${K8S_NAMESPACE}
```

---

## 배포 스크립트 사용법

### `docker-build.sh`

`.envrc` 환경변수 기반으로 Docker 이미지를 빌드합니다.

```bash
source .envrc
./docker-build.sh
```

**동작:**
1. `.envrc`에서 `VITE_LITELLM_BASE_URL`, `VITE_LITELLM_API_KEY` 읽기
2. Docker `--build-arg`로 전달하여 Vite 빌드에 포함
3. `${IMAGE_REPOSITORY}:${IMAGE_TAG}`로 이미지 태깅

### `deploy.sh`

`.envrc` 환경변수 기반으로 Helm 배포를 수행합니다.

```bash
source .envrc

./deploy.sh install     # 최초 설치
./deploy.sh upgrade     # 업그레이드 (설정/이미지 변경 후)
./deploy.sh template    # 매니페스트 확인 (dry-run, 실제 배포 안 함)
./deploy.sh uninstall   # 삭제
```

**동작:**
1. `.envrc`에서 모든 환경변수 읽기
2. `helm install/upgrade` 시 `--set`으로 값 오버라이드
3. `deployments/helm/` 차트 사용

---

## 환경변수 주입 흐름

환경변수는 다음 순서로 주입됩니다:

```
1. .envrc 수정 및 적용
       ↓
2. docker-build.sh → Dockerfile (빌드 인자로 VITE_* 전달)
       ↓
3. deploy.sh → Helm values (--set으로 오버라이드)
       ↓
4. Helm templates → K8s 리소스 생성
   ├── ConfigMap (VITE_LITELLM_BASE_URL, VITE_LITELLM_API_KEY)
   ├── Deployment (containerPort: 8080)
   ├── Service (port: 8080)
   ├── Istio Gateway (host: SERVICE_HOST)
   └── Istio VirtualService (host → service 라우팅)
```

> **참고**: `VITE_` 접두사가 붙은 환경변수는 Vite 빌드 시점에 번들에 포함됩니다.
> 런타임에 변경하려면 Docker 이미지를 다시 빌드해야 합니다.

---

## 에러 처리 및 재시도

### 자동 재시도 (Retry)

API 클라이언트는 다음 HTTP 상태 코드에 대해 **자동으로 최대 2회 재시도**합니다:

| 상태 코드 | 설명 | 재시도 |
|-----------|------|--------|
| `408` | Request Timeout (서버 측 타임아웃) | ✅ 재시도 |
| `429` | Too Many Requests (Rate Limit) | ✅ 재시도 |
| `500` | Internal Server Error | ✅ 재시도 |
| `502` | Bad Gateway | ✅ 재시도 |
| `503` | Service Unavailable | ✅ 재시도 |
| `504` | Gateway Timeout | ✅ 재시도 |
| 기타 | 4xx 에러 등 | ❌ 즉시 실패 |

재시도 간격은 **지수 백오프(Exponential Backoff)**를 사용합니다:
- 1차 재시도: 1초 후
- 2차 재시도: 2초 후

### 에러 타입

| 에러 타입 | 설명 |
|-----------|------|
| `NETWORK` | 네트워크 연결 실패 (DNS, CORS, 연결 거부 등) |
| `HTTP` | HTTP 에러 응답 (401, 403, 404 등) |
| `TIMEOUT` | 클라이언트 측 타임아웃 (요청 시간 초과) |
| `SERVER_TIMEOUT` | LLM 서버 측 타임아웃 (408 응답) |
| `PARSE` | JSON 응답 파싱 실패 |
| `UNKNOWN` | 알 수 없는 에러 |

### 타임아웃 설정

| API | 클라이언트 타임아웃 |
|-----|-------------------|
| 일반 API (models, embeddings) | 60초 |
| Chat Completions | 120초 |
| Health Check | 10초 |

---

## 트러블슈팅

### 408 Request Timeout (LiteLLM 서버 타임아웃)

**증상:**
```
HTTP 408 Request Timeout: LLM 서버 타임아웃 (408)
timeout value=1.0, time taken=1.01 seconds
```

**원인:** LiteLLM 서버의 `request_timeout` 또는 `timeout` 설정이 너무 짧습니다 (기본값: 1초).

**해결 방법:**

1. **LiteLLM 서버 설정 변경** (권장):
   ```bash
   # LiteLLM 서버 시작 시 타임아웃 늘리기
   litellm --request_timeout 300 --timeout 300

   # 또는 config.yaml에서 설정
   # general_settings:
   #   request_timeout: 300
   #   timeout: 300
   ```

2. **LiteLLM Proxy config.yaml 예시:**
   ```yaml
   general_settings:
     request_timeout: 300    # 5분
     timeout: 300            # 5분

   model_list:
     - model_name: auto
       litellm_params:
         model: your-model
         api_base: http://your-backend
         timeout: 300         # 모델별 타임아웃
   ```

3. **프론트엔드 측:** 이 앱은 자동으로 최대 2회 재시도합니다. 서버 설정을 변경할 수 없는 경우, 재시도로 일시적인 타임아웃을 완화할 수 있습니다.

### ECONNREFUSED 에러

**증상:**
```
Error: connect ECONNREFUSED 127.0.0.1:8000
```

**원인:** 이전 버전에서 사용하던 `/api` 프록시가 남아있거나, LiteLLM 서버에 연결할 수 없습니다.

**해결 방법:**
1. `.envrc`의 `VITE_LITELLM_BASE_URL`이 올바른지 확인
2. LiteLLM 서버가 실행 중인지 확인
3. 방화벽/네트워크 설정 확인

### 모델 목록이 비어있음

**증상:** 모델 선택 드롭다운이 비어있거나 "Loading models..." 상태가 지속됩니다.

**해결 방법:**
1. 브라우저 개발자 도구(F12) → Console 탭에서 에러 확인
2. `VITE_LITELLM_API_KEY`가 올바른지 확인
3. `VITE_LITELLM_BASE_URL`에 직접 접속하여 서버 상태 확인:
   ```bash
   curl -H "Authorization: Bearer ${VITE_LITELLM_API_KEY}" \
        ${VITE_LITELLM_BASE_URL}/v1/models
   ```

### HMR 경고 (개발 환경)

**증상:**
```
Could not Fast Refresh ("useChat" export is incompatible)
```

**해결:** 이 경고는 이미 수정되었습니다. `useChat` hook이 `src/hooks/useChat.ts`로 분리되어 Fast Refresh와 호환됩니다.

### Helm 배포 실패

**증상:** `./deploy.sh install` 실행 시 에러 발생

**해결 방법:**
```bash
# 1. 매니페스트 확인 (dry-run)
./deploy.sh template

# 2. 네임스페이스 존재 확인
kubectl get namespace ${K8S_NAMESPACE}

# 3. 이미지가 레지스트리에 있는지 확인
docker pull ${IMAGE_REPOSITORY}:${IMAGE_TAG}

# 4. Pod 상태 확인
kubectl get pods -n ${K8S_NAMESPACE}
kubectl describe pod <pod-name> -n ${K8S_NAMESPACE}
kubectl logs <pod-name> -n ${K8S_NAMESPACE}

# 5. 기존 릴리스 삭제 후 재설치
./deploy.sh uninstall
./deploy.sh install
```

### Istio 라우팅 문제

**증상:** Istio IngressGateway를 통해 접속이 안 됨

**해결 방법:**
```bash
# 1. Gateway/VirtualService 상태 확인
kubectl get gateway,virtualservice -n ${K8S_NAMESPACE}

# 2. Istio 사이드카 주입 확인
kubectl get pods -n ${K8S_NAMESPACE} -o jsonpath='{.items[*].spec.containers[*].name}'
# istio-proxy가 포함되어야 함

# 3. IngressGateway 로그 확인
kubectl logs -l app=istio-ingressgateway -n istio-system --tail=50

# 4. 네임스페이스에 Istio 주입 라벨 확인
kubectl get namespace ${K8S_NAMESPACE} --show-labels
# istio-injection=enabled 확인
```

---

## License

MIT