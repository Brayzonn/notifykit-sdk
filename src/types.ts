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
  priority?: number;
  idempotencyKey?: string;
}

export interface ApiInfo {
  name: string;
  version: string;
  description: string;
  documentation: string;
}

export interface SendWebhookOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload?: any;
  headers?: Record<string, string>;
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RetryJobResponse {
  jobId: string;
  status: string;
  message: string;
}
