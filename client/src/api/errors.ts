import { ApiClientError } from "./client";

export function formatErrorTitle(error: unknown, fallbackTitle: string) {
  if (error instanceof ApiClientError) return error.message || fallbackTitle;
  if (error instanceof Error) return error.message;
  return fallbackTitle;
}

export function formatErrorNotification(error: unknown, fallbackTitle: string) {
  if (error instanceof ApiClientError) {
    return {
      title: error.message || fallbackTitle,
      code: error.code,
      detail: error.log,
      suggestion: error.suggestion
    };
  }

  return {
    title: error instanceof Error ? error.message : fallbackTitle
  };
}
