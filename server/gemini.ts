import { GoogleGenAI, Type } from "@google/genai";
import type { VoiceProjectOption, VoiceParseResponse, VoiceTaskDraft } from "../src/voiceTypes";

interface ParseVoiceInput {
  transcriptHint?: string;
  audioBase64?: string;
  audioMimeType?: string;
  projects: VoiceProjectOption[];
  todayIsoDate: string;
  timezone: string;
}

const responseSchema = {
  type: Type.OBJECT,
  required: [
    "transcript",
    "title",
    "description",
    "projectId",
    "projectName",
    "status",
    "priority",
    "dueDate",
    "scheduledDate",
    "dependencyLabel",
    "owner",
    "effort",
    "tags",
    "confidence",
    "needsReview",
    "reviewReason",
  ],
  properties: {
    transcript: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    projectId: { type: Type.STRING, nullable: true },
    projectName: { type: Type.STRING, nullable: true },
    status: {
      type: Type.STRING,
      enum: ["inbox", "next", "in-progress", "waiting", "blocked", "delegated"],
    },
    priority: {
      type: Type.STRING,
      enum: ["critical", "high", "medium", "low"],
    },
    dueDate: { type: Type.STRING, nullable: true },
    scheduledDate: { type: Type.STRING, nullable: true },
    dependencyLabel: { type: Type.STRING, nullable: true },
    owner: { type: Type.STRING },
    effort: {
      type: Type.STRING,
      enum: ["quick", "medium", "deep"],
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    confidence: { type: Type.NUMBER },
    needsReview: { type: Type.BOOLEAN },
    reviewReason: { type: Type.STRING, nullable: true },
  },
} as const;

function normalizeDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeProjectId(projectId: string | null, projects: VoiceProjectOption[]) {
  if (!projectId) return null;
  return projects.some((project) => project.id === projectId) ? projectId : null;
}

function normalizeDraft(draft: VoiceTaskDraft, projects: VoiceProjectOption[]): VoiceTaskDraft {
  const projectId = normalizeProjectId(draft.projectId, projects);
  const projectName = projectId
    ? projects.find((project) => project.id === projectId)?.name ?? draft.projectName
    : draft.projectName;

  return {
    ...draft,
    title: draft.title.trim() || "Untitled task",
    description: draft.description.trim(),
    transcript: draft.transcript.trim(),
    projectId,
    projectName: projectId ? projectName ?? null : null,
    dueDate: normalizeDate(draft.dueDate),
    scheduledDate: normalizeDate(draft.scheduledDate),
    dependencyLabel: draft.dependencyLabel?.trim() || null,
    tags: draft.tags.filter(Boolean).map((tag) => tag.trim()).slice(0, 8),
    confidence: clampConfidence(draft.confidence),
    needsReview:
      draft.needsReview ||
      !projectId ||
      !draft.title.trim() ||
      clampConfidence(draft.confidence) < 0.72,
  };
}

function inferProjectIdFromTranscript(transcript: string, projects: VoiceProjectOption[]) {
  const normalized = transcript.toLowerCase();
  const project = projects.find((candidate) => normalized.includes(candidate.name.toLowerCase()));
  return project ?? null;
}

function localFallback(input: ParseVoiceInput): VoiceParseResponse {
  const transcript = (input.transcriptHint ?? "").trim();
  const normalized = transcript.toLowerCase();
  const matchedProject = inferProjectIdFromTranscript(transcript, input.projects);
  const dueDate =
    normalized.includes("today")
      ? input.todayIsoDate
      : normalized.includes("tomorrow")
        ? shiftDate(input.todayIsoDate, 1)
        : null;

  const draft: VoiceTaskDraft = normalizeDraft(
    {
      transcript,
      title: transcript || "Untitled task",
      description: "Parsed locally because GEMINI_API_KEY is not configured yet.",
      projectId: matchedProject?.id ?? null,
      projectName: matchedProject?.name ?? null,
      status: normalized.includes("waiting on")
        ? "waiting"
        : normalized.includes("blocked")
          ? "blocked"
          : normalized.includes("delegate")
            ? "delegated"
            : normalized.includes("working on")
              ? "in-progress"
              : "inbox",
      priority: normalized.includes("urgent") || normalized.includes("asap") ? "critical" : normalized.includes("important") ? "high" : "medium",
      dueDate,
      scheduledDate: null,
      dependencyLabel: normalized.includes("waiting on") ? "Needs follow-up" : null,
      owner: "Rahul",
      effort: normalized.includes("deep") ? "deep" : normalized.includes("quick") ? "quick" : "medium",
      tags: matchedProject ? [matchedProject.name.toLowerCase()] : ["captured"],
      confidence: matchedProject ? 0.62 : 0.42,
      needsReview: true,
      reviewReason: "Using local fallback parser. Add GEMINI_API_KEY for real transcription and extraction.",
    },
    input.projects,
  );

  return {
    draft,
    provider: "local-fallback",
    warnings: ["Gemini is not configured. Parsed the typed transcript with the local fallback."],
  };
}

function shiftDate(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function parseVoiceTask(input: ParseVoiceInput): Promise<VoiceParseResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return localFallback(input);

  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    "You are extracting a structured task from a user's dictated update.",
    `Today's date is ${input.todayIsoDate}.`,
    `The user's timezone is ${input.timezone}.`,
    "Return only the schema fields.",
    "If a due date is ambiguous, return null and set needsReview to true.",
    "Prefer exact ISO dates in YYYY-MM-DD format for dueDate and scheduledDate.",
    "Only use a projectId from this allowed list:",
    JSON.stringify(input.projects),
    "If no project matches clearly, set projectId and projectName to null and needsReview to true.",
    "If audio is provided, transcribe it accurately into the transcript field before extracting task data.",
  ].join("\n");

  const contents: Array<
    | string
    | {
        inlineData: {
          mimeType: string;
          data: string;
        };
      }
  > = [prompt];

  if (input.transcriptHint?.trim()) {
    contents.push(`User hint transcript: ${input.transcriptHint.trim()}`);
  }

  if (input.audioBase64 && input.audioMimeType) {
    contents.push({
      inlineData: {
        mimeType: input.audioMimeType,
        data: input.audioBase64,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as VoiceTaskDraft;
  const draft = normalizeDraft(parsed, input.projects);

  return {
    draft,
    provider: "gemini",
    warnings: draft.needsReview ? ["Review recommended before saving this task."] : [],
  };
}
