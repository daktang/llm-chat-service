# ✨ LLM Chat Service

LiteLLM API를 활용한 LLM 채팅 서비스입니다. React + Vite + shadcn/ui 기반의 프론트엔드로 구성되어 있으며, Kubernetes 환경에서의 배포를 지원합니다.

---

## 📋 목차

- [Quick Start](#quick-start)
- [프로젝트 구조](#프로젝트-구조)
- [환경변수 관리](#환경변수-관리)
- [로컬 개발](#로컬-개발)
- [Docker 이미지 빌드](#docker-이미지-빌드)
- [Kubernetes 배포 (Helm)](#kubernetes-배포-helm)
- [지원 API 엔드포인트](#지원-api-엔드포인트)
- [에러 처리 및 재시도](#에러-처리-및-재시도)
- [트러블슈팅](#트러블슈팅)

---

## Quick Start

### 로컬 개발

```bash
# 1. 환경변수 설정 (필수 3개: VITE_LITELLM_BASE_URL, VITE_LITELLM_API_KEY, VITE_PORT)
cp .envrc.sample .envrc
vi .envrc
source .envrc

# 2. 실행
pnpm install
pnpm run dev
# → http://localhost:3000
```

### Kubernetes 배포

```bash
# 1. 환경변수 설정
cp .envrc.sample .envrc
vi .envrc
source .envrc

# 2. Docker 이미지 빌드 & Push
./docker-build.sh
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}

# 3. Helm 배포 (Deployment + Service만 생성)
./deploy.sh install

# 4. Gateway/VirtualService는 직접 작성하여 적용
kubectl apply -f your-gateway.yaml -n ${K8S_NAMESPACE}
kubectl apply -f your-virtualservice.yaml -n ${K8S_NAMESPACE}
```

---

## 프로젝트 구조

```
.
├── .envrc                  # 환경변수 중앙 관리 (gitignore 대상)
├── .envrc.sample           # 환경변수 샘플
├── Dockerfile              # 내부망용 멀티스테이지 빌드 (nginx:8080)
├── deploy.sh               # Helm 배포 스크립트
├── docker-build.sh         # Docker 이미지 빌드 스크립트
├── deployments/
│   └── helm/               # Helm Chart (Deployment + Service만)
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── deployment.yaml
│           └── service.yaml
├── src/
│   ├── components/         # React 컴포넌트
│   ├── context/            # ChatContext
│   ├── hooks/              # useChat
│   ├── lib/
│   │   ├── api.ts          # API 클라이언트 (재시도, 로깅)
│   │   └── config.ts       # 환경변수 설정 (기본값 없음)
│   ├── pages/
│   ├── App.tsx
│   └── main.tsx
└── public/
```

---

## 환경변수 관리

**모든 설정은 `.envrc` 한 곳에서 관리합니다.** 기본값이 없으므로 설정하지 않으면 서버가 시작되지 않습니다.

### 설정 방법

```bash
cp .envrc.sample .envrc
vi .envrc          # 값 수정
source .envrc      # 적용 (또는 direnv allow)
```

### 환경변수 목록

| 변수명 | 필수 | 설명 | 사용처 |
|--------|------|------|--------|
| `VITE_LITELLM_BASE_URL` | ✅ | LiteLLM API 엔드포인트 | Vite 프록시, 프로덕션 API 호출 |
| `VITE_LITELLM_API_KEY` | ✅ | LiteLLM API 인증 키 | API 요청 Authorization 헤더 |
| `VITE_PORT` | - | 로컬 개발 서버 포트 (기본: 3000) | Vite dev server |
| `IMAGE_REPOSITORY` | ✅ (배포 시) | Docker 이미지 레포지토리 | docker-build.sh, deploy.sh |
| `IMAGE_TAG` | - | Docker 이미지 태그 (기본: latest) | docker-build.sh, deploy.sh |
| `K8S_NAMESPACE` | ✅ (배포 시) | Kubernetes 네임스페이스 | deploy.sh |
| `REPLICA_COUNT` | - | Pod 복제 수 (기본: 1) | deploy.sh |

### 환경변수 흐름

```
.envrc (한 곳에서 관리)
  ├── pnpm run dev     → vite.config.ts가 VITE_* 읽어서 프록시 설정 & 번들에 포함
  ├── docker-build.sh  → --build-arg로 VITE_* 3개 전달 → Dockerfile에서 빌드 시 번들에 포함
  └── deploy.sh        → --set으로 IMAGE_*, REPLICA_COUNT 전달 → Helm 배포
```

> **참고**: `VITE_` 접두사 환경변수는 Vite 빌드 시점에 번들에 포함됩니다. 런타임에 변경하려면 Docker 이미지를 다시 빌드해야 합니다.

---

## 로컬 개발

### 사전 요구사항

- Node.js 20+
- pnpm

### Step 1: 환경변수 설정

```bash
cp .envrc.sample .envrc
vi .envrc
# VITE_LITELLM_BASE_URL="https://openllm.domain.net"  ← 필수
# VITE_LITELLM_API_KEY="sk-your-key"                   ← 필수
# VITE_PORT="3000"                                      ← 선택
source .envrc
```

### Step 2: 실행

```bash
pnpm install
pnpm run dev
# → http://localhost:${VITE_PORT}
```

⚠️ `VITE_LITELLM_BASE_URL` 또는 `VITE_LITELLM_API_KEY`가 설정되지 않으면 서버가 시작되지 않고 에러 메시지가 출력됩니다:

```
❌ 환경변수 VITE_LITELLM_BASE_URL가 설정되지 않았습니다.
   .envrc 파일에서 VITE_LITELLM_BASE_URL를 설정한 후 source .envrc를 실행하세요.
```

### API 프록시 & 로그

개발 환경에서는 Vite 프록시를 통해 API 요청이 라우팅되며, 서버 터미널에 로그가 출력됩니다:

```
브라우저 → /llm/v1/* → Vite Proxy → VITE_LITELLM_BASE_URL/v1/*
```

### 빌드

```bash
pnpm run lint
pnpm run build    # dist/ 디렉토리에 생성
```

---

## Docker 이미지 빌드

### 사전 요구사항

- Docker
- 내부망 레지스트리 접근 가능 (domain.net)

### 빌드

```bash
source .envrc
./docker-build.sh
```

`docker-build.sh`는 `.envrc`의 환경변수를 **그대로** `--build-arg`로 전달합니다:

```
VITE_LITELLM_BASE_URL → --build-arg VITE_LITELLM_BASE_URL
VITE_LITELLM_API_KEY  → --build-arg VITE_LITELLM_API_KEY
VITE_PORT             → --build-arg VITE_PORT
```

⚠️ `VITE_LITELLM_BASE_URL`, `VITE_LITELLM_API_KEY`, `IMAGE_REPOSITORY`가 설정되지 않으면 빌드가 실패합니다.

### 로컬 테스트

```bash
docker run -d --name llm-chat -p 8080:8080 ${IMAGE_REPOSITORY}:${IMAGE_TAG}
open http://localhost:8080
docker stop llm-chat && docker rm llm-chat
```

### Push

```bash
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}
```

---

## Kubernetes 배포 (Helm)

Helm Chart는 **Deployment + Service만** 생성합니다. Gateway/VirtualService는 사용자가 직접 관리합니다.

### 사전 요구사항

- Kubernetes 클러스터
- Helm 3+
- Docker 이미지가 레지스트리에 Push된 상태

### Step 1: 환경변수 설정

```bash
cp .envrc.sample .envrc
vi .envrc
source .envrc
```

### Step 2: Docker 이미지 빌드 & Push

```bash
./docker-build.sh
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}
```

### Step 3: Helm 배포

```bash
# 매니페스트 확인 (dry-run)
./deploy.sh template

# 설치
./deploy.sh install

# 확인
kubectl get pods -n ${K8S_NAMESPACE}
kubectl get svc -n ${K8S_NAMESPACE}
```

### Step 4: Gateway/VirtualService 적용 (직접 관리)

```bash
# 사용자가 직접 작성한 GW/VS 적용
kubectl apply -f your-gateway.yaml -n ${K8S_NAMESPACE}
kubectl apply -f your-virtualservice.yaml -n ${K8S_NAMESPACE}
```

### Step 5: 접속 확인

```bash
# Port Forwarding (테스트용)
kubectl port-forward svc/llm-chat-service 8080:8080 -n ${K8S_NAMESPACE}
open http://localhost:8080

# 또는 Istio IngressGateway를 통해 접속
curl http://your-service-host
```

### 업데이트 배포

```bash
# .envrc에서 IMAGE_TAG 변경 후
source .envrc
./docker-build.sh
docker push ${IMAGE_REPOSITORY}:${IMAGE_TAG}
./deploy.sh upgrade
kubectl rollout status deployment/llm-chat-service -n ${K8S_NAMESPACE}
```

### 삭제

```bash
./deploy.sh uninstall
```

### deploy.sh 명령어

```bash
./deploy.sh install     # 최초 설치
./deploy.sh upgrade     # 업그레이드
./deploy.sh template    # 매니페스트 확인 (dry-run)
./deploy.sh uninstall   # 삭제
```

---

## 지원 API 엔드포인트

| 메서드 | 엔드포인트 | 설명 | 타임아웃 |
|--------|-----------|------|---------|
| `GET` | `/v1/models` | 모델 목록 조회 | 60초 |
| `GET` | `/v1/models/{id}` | 모델 상세 정보 | 60초 |
| `POST` | `/v1/chat/completions` | 채팅 | 120초 |
| `POST` | `/v1/completions` | 텍스트 완성 | 120초 |
| `POST` | `/v1/embeddings` | 임베딩 | 60초 |

---

## 에러 처리 및 재시도

### 자동 재시도

408, 429, 500, 502, 503, 504 에러 시 **최대 2회 자동 재시도** (지수 백오프: 1초 → 2초)

### 에러 타입

| 타입 | 설명 |
|------|------|
| `NETWORK` | 네트워크 연결 실패 |
| `HTTP` | HTTP 에러 (401, 403, 404 등) |
| `TIMEOUT` | 클라이언트 측 타임아웃 |
| `SERVER_TIMEOUT` | LLM 서버 측 타임아웃 (408) |
| `PARSE` | JSON 파싱 실패 |

---

## 트러블슈팅

### 서버가 시작되지 않음

```
❌ 환경변수 VITE_LITELLM_BASE_URL가 설정되지 않았습니다.
```

→ `.envrc`에서 필수 환경변수를 설정하고 `source .envrc` 실행

### 408 Request Timeout

```
LLM 서버 타임아웃 (408): 서버 측 timeout 설정이 너무 짧습니다 (현재: 1.0초)
```

→ LiteLLM 서버의 `request_timeout` 설정을 늘려야 합니다:
```bash
litellm --request_timeout 300 --timeout 300
```

→ 프론트엔드는 자동으로 최대 2회 재시도합니다.

### URL 변경하고 싶을 때

`.envrc`에서 `VITE_LITELLM_BASE_URL`만 변경하면 됩니다:

```bash
# .envrc
export VITE_LITELLM_BASE_URL="https://openllm.domain.net"
```

- **로컬 개발**: `source .envrc` 후 `pnpm run dev` 재시작
- **K8s 배포**: `source .envrc` 후 `./docker-build.sh` → `docker push` → `./deploy.sh upgrade`

---

## License

MIT