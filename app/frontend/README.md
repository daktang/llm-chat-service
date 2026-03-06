# ✨ LLM Chat Service

LiteLLM API를 활용한 LLM 채팅 서비스입니다. React + Vite + shadcn/ui 기반의 프론트엔드로 구성되어 있으며, Kubernetes + Istio 환경에서의 배포를 지원합니다.

---

## 📋 목차

- [프로젝트 구조](#프로젝트-구조)
- [환경변수 관리](#환경변수-관리)
- [로컬 개발 (Local Development)](#로컬-개발-local-development)
- [Kubernetes 배포 (Helm + Istio)](#kubernetes-배포-helm--istio)
- [배포 스크립트 사용법](#배포-스크립트-사용법)
- [환경변수 주입 흐름](#환경변수-주입-흐름)

---

## 프로젝트 구조

```
.
├── .envrc                  # 환경변수 중앙 관리 (gitignore 대상)
├── .envrc.sample           # 환경변수 샘플 (신규 개발자용)
├── .env.local              # Vite 빌드 시 사용되는 환경변수
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
│   ├── context/            # React Context (ChatContext)
│   ├── hooks/              # Custom Hooks
│   ├── lib/                # API 클라이언트, 설정, 유틸리티
│   ├── pages/              # 페이지 컴포넌트
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

### 실행 방법

```bash
# 1. 환경변수 적용
source .envrc

# 2. 의존성 설치
pnpm install

# 3. 개발 서버 실행
pnpm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다.

#### API 프록시 & 서버 터미널 로그

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

### 빌드 및 검증

```bash
# Lint 검사
pnpm run lint

# 프로덕션 빌드
pnpm run build
```

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

## Kubernetes 배포 (Helm + Istio)

### 사전 요구사항

- Kubernetes 클러스터
- Helm 3+
- Istio (istioctl 설치 및 클러스터에 배포 완료)
- Docker (이미지 빌드용)

### Step 1: 환경변수 설정

```bash
cp .envrc.sample .envrc
vi .envrc    # SERVICE_HOST, IMAGE_REPOSITORY 등 내부망에 맞게 수정
source .envrc
```

### Step 2: Docker 이미지 빌드

```bash
./docker-build.sh
```

이 스크립트는 `.envrc`의 환경변수를 사용하여:
- `VITE_LITELLM_BASE_URL`, `VITE_LITELLM_API_KEY`를 빌드 인자로 전달
- `IMAGE_REPOSITORY:IMAGE_TAG`로 이미지 태깅
- nginx가 **포트 8080**에서 서비스

### Step 3: 이미지 레지스트리에 Push (필요 시)

```bash
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}
```

### Step 4: Helm 배포

```bash
# 매니페스트 확인 (dry-run)
./deploy.sh template

# 설치
./deploy.sh install

# 업그레이드 (설정 변경 후)
./deploy.sh upgrade

# 삭제
./deploy.sh uninstall
```

### Step 5: 접속 확인

```bash
# Port Forwarding으로 로컬 테스트
kubectl port-forward svc/llm-chat-service 8080:8080 -n ${K8S_NAMESPACE}

# 브라우저에서 접속
open http://localhost:8080
```

### Istio를 통한 접속

Istio IngressGateway를 통해 `SERVICE_HOST`로 접속할 수 있습니다:

```bash
# Istio IngressGateway의 External IP 확인
kubectl get svc istio-ingressgateway -n istio-system

# /etc/hosts에 추가 (내부망의 경우)
# <EXTERNAL_IP>  llm-chat.internal.example.com

# 접속
curl http://${SERVICE_HOST}
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

---

## 배포 스크립트 사용법

### `docker-build.sh`

`.envrc` 환경변수 기반으로 Docker 이미지를 빌드합니다.

```bash
source .envrc
./docker-build.sh
```

### `deploy.sh`

`.envrc` 환경변수 기반으로 Helm 배포를 수행합니다.

```bash
source .envrc

./deploy.sh install     # 최초 설치
./deploy.sh upgrade     # 업그레이드
./deploy.sh template    # 매니페스트 확인 (dry-run)
./deploy.sh uninstall   # 삭제
```

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

## License

MIT