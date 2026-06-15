import type { ModelProviderKind } from "@forge/sdk";

export const modelProviderOptions: Array<{
  defaultBaseUrl: string;
  defaultModelName: string;
  label: string;
  value: ModelProviderKind;
}> = [
  {
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelName: "gpt-4.1-mini",
    label: "OpenAI-compatible",
    value: "openai-compatible"
  },
  {
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelName: "gpt-4.1-mini",
    label: "OpenAI",
    value: "openai"
  },
  {
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModelName: "claude-sonnet-4-20250514",
    label: "Anthropic",
    value: "anthropic"
  },
  {
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelName: "gemini-2.5-flash",
    label: "Google Gemini",
    value: "google"
  },
  {
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModelName: "mistral-large-latest",
    label: "Mistral",
    value: "mistral"
  },
  {
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModelName: "llama-3.3-70b-versatile",
    label: "Groq",
    value: "groq"
  },
  {
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModelName: "deepseek-chat",
    label: "DeepSeek",
    value: "deepseek"
  },
  {
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModelName: "openai/gpt-4.1-mini",
    label: "OpenRouter",
    value: "openrouter"
  },
  {
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModelName: "llama3.1",
    label: "Ollama",
    value: "ollama"
  },
  {
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultModelName: "local-model",
    label: "LM Studio",
    value: "lmstudio"
  }
];

export function getModelSettingsForProviderChange(
  modelProvider: ModelProviderKind
) {
  const option = modelProviderOptions.find(
    (providerOption) => providerOption.value === modelProvider
  );

  return {
    modelBaseUrl: option?.defaultBaseUrl ?? "",
    modelName: option?.defaultModelName ?? "",
    modelProvider
  };
}
