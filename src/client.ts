import {
  NotifyKitConfig,
  SendEmailOptions,
  SendWebhookOptions,
  JobResponse,
  JobStatus,
  JobSummary,
  ApiInfo,
  PaginationMeta,
  RetryJobResponse,
} from './types';
import { NotifyKitError } from './errors';

/** Abort a request that hasn't responded within this window. */
const TIMEOUT_MS = 10_000;

/** Backoff delays between retries; length also caps the retry count (2 retries / 3 attempts). */
const RETRY_DELAYS_MS = [200, 500];

/** Upper bound for a server-provided Retry-After so a caller can't be stalled indefinitely. */
const MAX_RETRY_AFTER_MS = 10_000;

/**
 * Methods we can safely re-send after a transport failure (timeout / dropped connection).
 * A timed-out POST may already have been processed by the server, so retrying it could
 * duplicate a notification — only idempotent methods are retried on transport errors.
 */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD']);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient server states worth retrying regardless of HTTP method. */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function describeTransportError(err: unknown): string {
  if (err instanceof Error && err.name === 'TimeoutError') return 'Request timed out';
  if (err instanceof Error) return err.message;
  return 'Network error occurred';
}

/** Build a NotifyKitError from a non-OK (or success:false) response body. */
function toError(status: number, statusText: string, data: any): NotifyKitError {
  let message = statusText || 'Request failed';
  let errors: any[] | undefined;
  let retryAfter: number | undefined;

  if (data) {
    const detail = data.error ?? data.message;
    if (Array.isArray(detail)) {
      errors = detail;
      message = data.error ? detail.join(', ') : 'Validation failed';
    } else if (detail != null) {
      message = String(detail);
    }

    if (status === 429 && typeof data.retryAfter === 'number') {
      retryAfter = data.retryAfter;
    }
  }

  return new NotifyKitError(message, status, data, errors, retryAfter);
}

export class NotifyKitClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: NotifyKitConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.baseUrl = (config.baseUrl ?? 'https://api.notifykit.dev').replace(/\/$/, '');
    this.headers = {
      'X-API-Key': config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const retryTransport = IDEMPOTENT_METHODS.has(method);

    for (let attempt = 0; ; attempt++) {
      const isLastAttempt = attempt >= RETRY_DELAYS_MS.length;

      // --- Send ---
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: this.headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        // Transport failure: retry only idempotent requests, and only while attempts remain.
        if (retryTransport && !isLastAttempt) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new NotifyKitError(describeTransportError(err));
      }

      const data: any = await res.json().catch(() => null);

      // --- Success ---
      if (res.ok && data?.success !== false) {
        return (data?.data ?? data) as T;
      }

      // --- Failure ---
      const error = toError(res.status, res.statusText, data);

      // Retry transient server states (5xx / 429) for any method; a 4xx fails immediately.
      if (isRetryableStatus(res.status) && !isLastAttempt) {
        const delay =
          error.retryAfter != null
            ? Math.min(error.retryAfter * 1000, MAX_RETRY_AFTER_MS)
            : RETRY_DELAYS_MS[attempt];
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  // ================================
  // APP
  // ================================

  /** Test API connection */
  async ping(): Promise<string> {
    return this.request<string>('GET', '/api/v1/ping');
  }

  /** Get API information */
  async getApiInfo(): Promise<ApiInfo> {
    return this.request<ApiInfo>('GET', '/api/v1/info');
  }

  // ================================
  // NOTIFICATIONS
  // ================================

  /** Send an email notification */
  async sendEmail(options: SendEmailOptions): Promise<JobResponse> {
    return this.request<JobResponse>('POST', '/api/v1/notifications/email', options);
  }

  /** Send a webhook notification */
  async sendWebhook(options: SendWebhookOptions): Promise<JobResponse> {
    return this.request<JobResponse>('POST', '/api/v1/notifications/webhook', options);
  }

  /** Get job status by ID */
  async getJob(jobId: string): Promise<JobStatus> {
    return this.request<JobStatus>('GET', `/api/v1/notifications/jobs/${jobId}`);
  }

  /** List jobs with optional filters */
  async listJobs(options?: {
    page?: number;
    limit?: number;
    type?: 'email' | 'webhook';
    status?: 'pending' | 'processing' | 'completed' | 'failed';
  }): Promise<{ data: JobSummary[]; pagination: PaginationMeta }> {
    let path = '/api/v1/notifications/jobs';
    if (options) {
      const params = new URLSearchParams(
        Object.entries(options)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)] as [string, string]),
      );
      if (params.size > 0) path += `?${params}`;
    }
    return this.request<{ data: JobSummary[]; pagination: PaginationMeta }>('GET', path);
  }

  /** Retry a failed job */
  async retryJob(jobId: string): Promise<RetryJobResponse> {
    return this.request<RetryJobResponse>('POST', `/api/v1/notifications/jobs/${jobId}/retry`);
  }
}
