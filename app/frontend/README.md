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

```bash
# 1. 환경변수 설정
cp .envrc.sample .envrc
vi .envrc          # VITE_LITELLM_BASE_URL, VITE_LITELLM_API_KEY 설정
source .envrc

# 2. 실행
pnpm install
pnpm run dev
# → http://localhost:3000
```

---

## 프로젝트 구조

```
.
├── .envrc                  # 환경변수 중앙 관리 (gitignore 대상)
├── .envrc.sample           # 환경변수 샘플
├── Dockerfile              # 내부망용 멀티스테이지 빌드 (nginx:8080)
├── deployments/
│   └── helm/               # Helm Chart (Deployment + Service)
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

### 환경변수 목록

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `VITE_LITELLM_BASE_URL` | ✅ | LiteLLM API 엔드포인트 (예: `https://openllm.your-domain.net`) |
| `VITE_LITELLM_API_KEY` | ✅ | LiteLLM API 인증 키 |
| `VITE_PORT` | - | 로컬 개발 서버 포트 (기본: 3000) |

### 환경변수 흐름

```
.envrc (한 곳에서 관리)
  ├── pnpm run dev     → vite.config.ts가 VITE_* 읽어서 프록시 설정 & 번들에 포함
  └── docker build     → --build-arg로 VITE_* 전달 → 빌드 시 번들에 포함
```

> **중요**: `VITE_` 접두사 환경변수는 Vite 빌드 시점에 번들에 포함됩니다. 런타임에 변경할 수 없으며, 값을 바꾸려면 이미지를 다시 빌드해야 합니다.

---

## 로컬 개발

### Step 1: 환경변수 설정

```bash
cp .envrc.sample .envrc
vi .envrc
source .envrc
```

### Step 2: 실행

```bash
pnpm install
pnpm run dev
# → http://localhost:${VITE_PORT}
```

### API 프록시 & 로그

개발 환경에서는 Vite 프록시를 통해 API 요청이 라우팅되며, 서버 터미널에 Request/Response 로그가 출력됩니다:

```
브라우저 → /llm/v1/* → Vite Proxy → VITE_LITELLM_BASE_URL/v1/*
```

---

## Docker 이미지 빌드

### 빌드 명령어

`VITE_*` 환경변수는 `--build-arg`로 전달합니다:

```bash
docker build \
  --build-arg VITE_LITELLM_BASE_URL="https://openllm.your-domain.net" \
  --build-arg VITE_LITELLM_API_KEY="sk-your-key" \
  -t your-registry/llm-chat-service:latest \
  .
```

또는 `.envrc`를 source한 상태에서:

```bash
source .envrc

docker build \
  --build-arg VITE_LITELLM_BASE_URL="${VITE_LITELLM_BASE_URL}" \
  --build-arg VITE_LITELLM_API_KEY="${VITE_LITELLM_API_KEY}" \
  -t your-registry/llm-chat-service:latest \
  .
```

### 유의사항

1. **`--build-arg`는 필수입니다**
   - `VITE_LITELLM_BASE_URL`과 `VITE_LITELLM_API_KEY`를 전달하지 않으면 빌드가 실패합니다 (`process.exit(1)`)
   - `VITE_PORT`는 선택 (기본값 3000, 빌드 결과에 영향 없음)

2. **값 변경 = 이미지 재빌드**
   - `VITE_*` 환경변수는 Vite가 빌드 시점에 JavaScript 번들에 하드코딩합니다
   - URL이나 API 키를 변경하려면 반드시 `docker build`를 다시 실행해야 합니다
   - 런타임에 환경변수를 주입하는 방식(`docker run -e`)으로는 변경할 수 없습니다

3. **API 키 보안**
   - `--build-arg`로 전달한 값은 Docker 이미지 레이어에 남습니다
   - `docker history`로 확인 가능하므로, 이미지를 외부에 공유할 때 주의하세요
   - 필요 시 Docker BuildKit의 `--secret` 옵션을 사용할 수 있습니다:
     ```bash
     DOCKER_BUILDKIT=1 docker build \
       --secret id=api_key,env=VITE_LITELLM_API_KEY \
       ...
     ```

4. **`.npmrc` 파일**
   - Dockerfile이 `.npmrc`를 `/root/.npmrc`로 복사합니다
   - 내부 npm 레지스트리를 사용하는 경우 `.npmrc`에 설정이 필요합니다
   - 사용하지 않는 경우 빈 파일이어도 무방합니다

### 로컬 테스트

```bash
docker run -d --name llm-chat -p 8080:8080 your-registry/llm-chat-service:latest
open http://localhost:8080
docker stop llm-chat && docker rm llm-chat
```

### Push

```bash
docker push your-registry/llm-chat-service:latest
```

---

## Kubernetes 배포 (Helm)

Helm Chart는 **Deployment + Service만** 생성합니다. Gateway/VirtualService는 사용자가 직접 관리합니다.

### 배포

```bash
# 매니페스트 확인 (dry-run)
helm template llm-chat-service ./deployments/helm \
  --set image.repository=your-registry/llm-chat-service \
  --set image.tag=latest

# 설치
helm install llm-chat-service ./deployments/helm \
  --namespace your-namespace \
  --create-namespace \
  --set image.repository=your-registry/llm-chat-service \
  --set image.tag=latest \
  --set replicaCount=2

# 업그레이드
helm upgrade llm-chat-service ./deployments/helm \
  --namespace your-namespace \
  --set image.repository=your-registry/llm-chat-service \
  --set image.tag=v1.1.0

# 삭제
helm uninstall llm-chat-service --namespace your-namespace
```

### Helm Values

| 값 | 기본값 | 설명 |
|----|--------|------|
| `image.repository` | `""` | Docker 이미지 레포지토리 (필수) |
| `image.tag` | `"latest"` | Docker 이미지 태그 |
| `image.pullPolicy` | `IfNotPresent` | 이미지 Pull 정책 |
| `replicaCount` | `1` | Pod 복제 수 |
| `service.type` | `ClusterIP` | Service 타입 |
| `service.port` | `8080` | Service 포트 |
| `resources.limits.cpu` | `200m` | CPU 제한 |
| `resources.limits.memory` | `256Mi` | 메모리 제한 |

### Gateway/VirtualService

Helm Chart에 포함되어 있지 않습니다. 환경에 맞게 직접 작성하여 적용하세요:

```bash
kubectl apply -f your-gateway.yaml -n your-namespace
kubectl apply -f your-virtualservice.yaml -n your-namespace
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

### Docker 빌드 실패

```
❌ 환경변수 VITE_LITELLM_BASE_URL가 설정되지 않았습니다.
```

→ `--build-arg`로 환경변수를 전달했는지 확인:
```bash
docker build \
  --build-arg VITE_LITELLM_BASE_URL="https://..." \
  --build-arg VITE_LITELLM_API_KEY="sk-..." \
  -t ... .
```

### 408 Request Timeout

→ LiteLLM 서버의 `request_timeout` 설정을 늘려야 합니다:
```bash
litellm --request_timeout 300 --timeout 300
```

### API 응답이 HTML로 옴

→ `VITE_LITELLM_BASE_URL`이 실제 LiteLLM 서버 주소가 맞는지 확인하세요. "Coming Soon" 같은 HTML이 오면 URL이 잘못된 것입니다.

---

## License

MIT