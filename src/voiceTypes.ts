import type { TaskEffort, TaskPriority, TaskStatus } from "./types";

export interface VoiceProjectOption {
  id: string;
  name: string;
}

export interface VoiceTaskDraft {
  transcript: string;
  title: string;
  description: string;
  projectId: string | null;
  projectName: string | null;
  status: Exclude<TaskStatus, "done">;
  priority: TaskPriority;
  dueDate: string | null;
  scheduledDate: string | null;
  dependencyLabel: string | null;
  owner: string;
  effort: TaskEffort;
  tags: string[];
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
}

export interface VoiceParseResponse {
  draft: VoiceTaskDraft;
  provider: "gemini" | "local-fallback";
  warnings: string[];
}
