import { OpenAiError } from '@/api';
import { delay } from '@/util';

const DEFAULT_MAX_DELAY_MS = 30_000;

export interface RetryPolicyConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class RetryableError extends Error {
  category:
    | 'network'
    | 'rate-limit'
    | 'server'
    | 'output-invalid'
    | 'upload-temporary';
  constructor(
    message: string,
    category: RetryableError['category'] = 'network',
  ) {
    super(message);
    this.category = category;
  }
}

export class FatalError extends Error {}

export class RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;

  constructor(config?: RetryPolicyConfig) {
    this.maxAttempts = config?.maxAttempts ?? 4;
    this.baseDelayMs = config?.baseDelayMs ?? 1000;
    this.maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  async run<T>(
    fn: (attempt: number) => Promise<T>,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (error: unknown) {
        lastError = error;
        if (!this.shouldRetry(error) || attempt + 1 >= this.maxAttempts) {
          throw error;
        }
        const sleepMs = this.backoffMs(attempt);
        await delay(sleepMs, options?.signal);
      }
    }
    throw lastError;
  }

  shouldRetry(error: unknown) {
    if (error instanceof RetryableError) {
      return true;
    }
    if (error instanceof FatalError) {
      return false;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false;
    }
    if (error instanceof OpenAiError) {
      if (error.status === 401 || error.status === 403) return false;
      if (
        error.status === 429 ||
        error.status === 408 ||
        (error.status !== undefined && error.status >= 500)
      ) {
        return true;
      }
      const code = error.code ?? '';
      if (code === 'rate_limit_exceeded') return true;
      if (
        code === 'invalid_api_key' ||
        code === 'account_deactivated' ||
        code === 'insufficient_quota'
      ) {
        return false;
      }
    }
    if (error instanceof TypeError) {
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      /timeout|timed out|network|fetch|socket|temporarily|gateway|too many requests/i.test(
        message,
      )
    ) {
      return true;
    }
    return false;
  }

  private backoffMs(attempt: number) {
    const exp = this.baseDelayMs * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 500);
    return Math.min(exp + jitter, this.maxDelayMs);
  }
}
