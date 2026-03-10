// ============================================
// LLM Chat Service - Configuration
// ============================================
// 환경변수 기반 설정만 사용합니다.
// VITE_LITELLM_BASE_URL과 VITE_LITELLM_API_KEY는
// .envrc → Vite 빌드 시 번들에 포함됩니다.
//
// ⚠️ 기본값 없음. 설정하지 않으면 에러 발생.
// ============================================

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `❌ 환경변수 ${key}가 설정되지 않았습니다.\n` +
      `.envrc 파일에서 ${key}를 설정한 후 source .envrc를 실행하세요.`
    );
  }
  return value;
}

export const config = {
  /** LiteLLM API Base URL (필수) */
  get API_BASE_URL(): string {
    return requireEnv("VITE_LITELLM_BASE_URL");
  },

  /** LiteLLM API Key (필수) */
  get API_KEY(): string {
    return requireEnv("VITE_LITELLM_API_KEY");
  },
};