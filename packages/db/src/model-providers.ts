import type { ModelProviderKind } from "./domain.js";

export const modelProviderDefaults: Record<
  ModelProviderKind,
  {
    baseUrl: string;
    modelName: string;
    requiresApiKey: boolean;
  }
> = {
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    modelName: "claude-sonnet-4-20250514",
    requiresApiKey: true
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    modelName: "deepseek-chat",
    requiresApiKey: true
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelName: "gemini-2.5-flash",
    requiresApiKey: true
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    modelName: "llama-3.3-70b-versatile",
    requiresApiKey: true
  },
  lmstudio: {
    baseUrl: "http://localhost:1234/v1",
    modelName: "local-model",
    requiresApiKey: false
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    modelName: "mistral-large-latest",
    requiresApiKey: true
  },
  ollama: {
    baseUrl: "http://127.0.0.1:11434/v1",
    modelName: "llama3.1",
    requiresApiKey: false
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1-mini",
    requiresApiKey: true
  },
  "openai-compatible": {
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1-mini",
    requiresApiKey: true
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "openai/gpt-4.1-mini",
    requiresApiKey: true
  }
};
