export type ProviderErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "invalid_base_url"
  | "model_not_found"
  | "rate_limited"
  | "quota_exceeded"
  | "unsupported_capability"
  | "provider_error"
  | "network_error";

export interface ProviderErrorDetails {
  providerMessage?: string;
  statusCode?: number;
  suggestion?: string;
}

export class ProviderError extends Error {
  readonly providerMessage?: string;
  readonly statusCode?: number;
  readonly suggestion?: string;

  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    details: ProviderErrorDetails = {}
  ) {
    super(message);
    this.name = "ProviderError";
    this.providerMessage = details.providerMessage;
    this.statusCode = details.statusCode;
    this.suggestion = details.suggestion;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      providerMessage: this.providerMessage,
      statusCode: this.statusCode,
      suggestion: this.suggestion
    };
  }
}
