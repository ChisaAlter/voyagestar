import { request } from "../request";
import type {
  VoyagestarCronRow,
  VoyagestarCronCreateBody,
  VoyagestarCronPatchBody,
} from "../types";

export interface VoyagestarCronSettings {
  timezone: string;
}

export interface CronTaskExamples {
  zh?: string[];
  en?: string[];
}

export interface CronExamplesResponse {
  task_examples: CronTaskExamples | null;
}

export const voyagestarCronApi = {
  settings: () => request<VoyagestarCronSettings>("/cron/settings"),

  examples: (agentId: string) =>
    request<CronExamplesResponse>(`/agents/${agentId}/cron/examples`),

  list: (agentId: string) => request<VoyagestarCronRow[]>(`/agents/${agentId}/cron`),

  create: (agentId: string, body: VoyagestarCronCreateBody) =>
    request<VoyagestarCronRow>(`/agents/${agentId}/cron`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  get: (agentId: string, cronId: string) =>
    request<VoyagestarCronRow>(`/agents/${agentId}/cron/${cronId}`),

  patch: (agentId: string, cronId: string, body: VoyagestarCronPatchBody) =>
    request<VoyagestarCronRow>(`/agents/${agentId}/cron/${cronId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (agentId: string, cronId: string) =>
    request<void>(`/agents/${agentId}/cron/${cronId}`, { method: "DELETE" }),

  runNow: (agentId: string, cronId: string) =>
    request<void>(`/agents/${agentId}/cron/${cronId}/run-now`, {
      method: "POST",
    }),
};
