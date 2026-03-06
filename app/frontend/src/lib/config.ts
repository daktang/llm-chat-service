// ============================================
// LLM Chat Service - Configuration
// ============================================
// 환경변수 기반 설정만 사용합니다.
// VITE_LITELLM_BASE_URL과 VITE_LITELLM_API_KEY는
// .envrc → Vite 빌드 시 번들에 포함됩니다.
// ============================================

export const config = {
  /** LiteLLM API Base URL */
  get API_BASE_URL(): string {
    return import.meta.env.VITE_LITELLM_BASE_URL || "https://openllm.net";
  },

  /** LiteLLM API Key */
  get API_KEY(): string {
    return import.meta.env.VITE_LITELLM_API_KEY || "";
  },
};