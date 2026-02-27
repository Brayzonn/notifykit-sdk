export interface NotifyKitConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
  priority?: 1 | 5 | 10;
  idempotencyKey?: string;
}

export interface SendWebhookOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  payload: any;
  headers?: Record<string, string>;
  priority?: 1 | 5 | 10;
  idempotencyKey?: string;
}

export interface JobResponse {
  jobId: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface JobStatus {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  priority: number;
  payload: object;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RetryJobResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface ApiInfo {
  name: string;
  version: string;
  description: string;
  documentation: string;
}
