export type ProjectType = "work" | "personal" | "side-project";

export type TaskStatus =
  | "inbox"
  | "next"
  | "in-progress"
  | "waiting"
  | "blocked"
  | "delegated"
  | "done";

export type TaskPriority = "critical" | "high" | "medium" | "low";

export type TaskEffort = "quick" | "medium" | "deep";

export type ViewMode = "dashboard" | "projects" | "capture" | "calendar";

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  scheduledDate: string | null;
  startDate: string | null;
  owner: string;
  dependencyLabel: string | null;
  effort: TaskEffort;
  tags: string[];
}
