import { useMemo, useRef, useState } from "react";
import { projects, seededTasks } from "./data";
import type { Project, Task, TaskPriority, TaskStatus, ViewMode } from "./types";
import type { VoiceParseResponse, VoiceTaskDraft } from "./voiceTypes";

const today = "2026-03-22";

const priorityWeight: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const statusLabel: Record<TaskStatus, string> = {
  inbox: "Pending",
  next: "Pending",
  "in-progress": "In Progress",
  waiting: "Waiting",
  blocked: "Blocked",
  delegated: "Delegated",
  done: "Completed",
};

const navItems: { id: ViewMode; label: string; icon: string }[] = [
  { id: "dashboard", label: "Today", icon: "wb_sunny" },
  { id: "projects", label: "Projects", icon: "tally" },
  { id: "capture", label: "Add", icon: "mic" },
  { id: "calendar", label: "Calendar", icon: "calendar_today" },
];

function differenceInDays(date: string | null) {
  if (!date) return null;

  const start = new Date(`${today}T00:00:00`);
  const end = new Date(`${date}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string | null) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function startOfWeek(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  return start;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getUrgency(task: Task) {
  const days = differenceInDays(task.dueDate);

  if (days !== null && days < 0) return { label: "Overdue", tone: "urgent" };
  if (days === 0) return { label: "Today", tone: "urgent" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (task.priority === "critical") return { label: "Critical", tone: "urgent" };
  if (task.priority === "high") return { label: "High", tone: "soon" };
  return { label: "Calm", tone: "calm" };
}

function draftToTask(draft: VoiceTaskDraft): Task {
  return {
    id: `task-${crypto.randomUUID()}`,
    title: draft.title.trim() || "Untitled task",
    description: draft.description.trim() || "Captured with voice update.",
    projectId: draft.projectId ?? "personal",
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate,
    scheduledDate: draft.scheduledDate,
    startDate: today,
    owner: draft.owner || "Rahul",
    dependencyLabel: draft.dependencyLabel,
    effort: draft.effort,
    tags: draft.tags.length > 0 ? draft.tags : ["captured"],
  };
}

function App() {
  const [view, setView] = useState<ViewMode>("dashboard");
  const [tasks, setTasks] = useState<Task[]>(seededTasks);
  const [captureInput, setCaptureInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("flywheel");
  const [selectedDate, setSelectedDate] = useState(today);
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<VoiceParseResponse | null>(null);
  const [reviewDraft, setReviewDraft] = useState<VoiceTaskDraft | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [lastSavedTaskId, setLastSavedTaskId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const projectById = useMemo(
    () =>
      projects.reduce<Record<string, Project>>((map, project) => {
        map[project.id] = project;
        return map;
      }, {}),
    [],
  );

  const weekDates = useMemo(() => {
    const start = startOfWeek(today);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, []);

  const actionable = useMemo(
    () =>
      tasks
        .filter((task) => ["next", "in-progress"].includes(task.status))
        .sort((left, right) => {
          const leftDays = differenceInDays(left.dueDate) ?? 999;
          const rightDays = differenceInDays(right.dueDate) ?? 999;
          if (leftDays !== rightDays) return leftDays - rightDays;
          return priorityWeight[right.priority] - priorityWeight[left.priority];
        }),
    [tasks],
  );

  const metrics = useMemo(
    () => ({
      urgent: tasks.filter((task) => {
        const days = differenceInDays(task.dueDate);
        return (days !== null && days <= 0) || task.priority === "critical";
      }),
      overdue: tasks.filter((task) => (differenceInDays(task.dueDate) ?? 1) < 0 && task.status !== "done"),
      upcoming: tasks.filter((task) => {
        const days = differenceInDays(task.dueDate);
        return days !== null && days > 0 && days <= 2;
      }),
    }),
    [tasks],
  );

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const selectedProjectTasks = tasks.filter((task) => task.projectId === selectedProject.id);
  const selectedDayTasks = tasks.filter(
    (task) => task.dueDate === selectedDate || task.scheduledDate === selectedDate,
  );

  const groupedProjectTasks = {
    blocked: selectedProjectTasks.filter((task) => ["blocked", "waiting"].includes(task.status)),
    progress: selectedProjectTasks.filter((task) => task.status === "in-progress"),
    pending: selectedProjectTasks.filter((task) => ["next", "inbox", "delegated"].includes(task.status)),
    completed: selectedProjectTasks.filter((task) => task.status === "done"),
  };

  async function startRecording() {
    setParseError(null);

    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      setParseError("Voice recording is not supported in this browser. You can still type a task below.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setAudioBlob(blob);
      stream.getTracks().forEach((track) => track.stop());
    };

    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  async function parseCapture() {
    if (!captureInput.trim() && !audioBlob) {
      setParseError("Add a transcript or record audio first.");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setLastSavedTaskId(null);

    try {
      const formData = new FormData();
      formData.append("transcript", captureInput);
      formData.append("todayIsoDate", today);
      formData.append("timezone", "Asia/Kolkata");

      if (audioBlob) {
        formData.append("audio", new File([audioBlob], "voice-note.webm", { type: audioBlob.type || "audio/webm" }));
      }

      const response = await fetch("/api/voice-task/parse", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as VoiceParseResponse | { error: string };
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to parse voice task.");
      }

      setParseResult(data);
      setReviewDraft(data.draft);
      if (data.draft.projectId) setSelectedProjectId(data.draft.projectId);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not parse that task.");
    } finally {
      setIsParsing(false);
    }
  }

  function saveReviewedTask() {
    if (!reviewDraft) return;

    const savedTask = draftToTask(reviewDraft);
    setTasks((current) => [savedTask, ...current]);
    setLastSavedTaskId(savedTask.id);
    setSelectedProjectId(savedTask.projectId);
    setView("projects");
  }

  function cycleStatus(taskId: string) {
    const ordered: TaskStatus[] = ["inbox", "next", "in-progress", "waiting", "delegated", "done"];

    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const index = ordered.indexOf(task.status);
        return { ...task, status: ordered[(index + 1) % ordered.length] };
      }),
    );
  }

  const completion = Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100);

  return (
    <div className="curator-app">
      <TopBar title={view === "dashboard" ? "Today" : view === "projects" ? "Projects" : view === "capture" ? "Smart Add" : "Schedule"} />

      <main className="page-shell">
        {view === "dashboard" && (
          <section className="today-screen">
            <header className="hero-intro">
              <p className="kicker">Morning, Rahul</p>
              <div className="hero-row">
                <div>
                  <h2>Your Daily Curator</h2>
                  <p className="subtle-copy">A calm snapshot of what needs your attention next.</p>
                </div>
                <ProgressRing value={completion} />
              </div>
            </header>

            <section className="summary-grid">
              <MetricCard label="Urgent" value={metrics.urgent.length} note="Requiring immediate attention" tone="urgent" icon="error" />
              <MetricCard label="Overdue" value={metrics.overdue.length} note="Carried over and still open" tone="neutral" icon="history" />
              <MetricCard label="Upcoming" value={metrics.upcoming.length} note="Due in the next 48 hours" tone="neutral" icon="event_note" />
            </section>

            <button className="dictation-card" onClick={() => setView("capture")}>
              <div className="dictation-content">
                <span className="material-symbols-outlined fill-icon">mic</span>
                <div>
                  <strong>Smart Dictation</strong>
                  <p>Transcribe, classify, and route a task into the right project.</p>
                </div>
              </div>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>

            <section className="today-columns">
              <div className="editorial-stack">
                {projects.map((project) => {
                  const projectTasks = actionable.filter((task) => task.projectId === project.id).slice(0, 3);
                  if (projectTasks.length === 0) return null;

                  return (
                    <section key={project.id} className="project-group">
                      <div className="group-heading">
                        <span className="project-dot" style={{ backgroundColor: project.color }} />
                        <h3>{project.name}</h3>
                      </div>
                      <div className="task-stack">
                        {projectTasks.map((task) => (
                          <TaskRow key={task.id} task={task} project={project} onCycleStatus={cycleStatus} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              <aside className="dashboard-rail">
                <section className="mini-calendar-card">
                  <div className="card-heading">
                    <div>
                      <h3>This Week</h3>
                      <p>{selectedDayTasks.length} items on the selected day</p>
                    </div>
                    <button className="ghost-button" onClick={() => setView("calendar")}>
                      Open
                    </button>
                  </div>
                  <div className="week-pills">
                    {weekDates.map((date) => {
                      const dateKey = isoDate(date);
                      const dayTasks = tasks.filter(
                        (task) => task.dueDate === dateKey || task.scheduledDate === dateKey,
                      );
                      const isSelected = selectedDate === dateKey;
                      return (
                        <button
                          key={dateKey}
                          className={`week-pill ${isSelected ? "active" : ""}`}
                          onClick={() => setSelectedDate(dateKey)}
                        >
                          <span>{date.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                          <strong>{date.getDate()}</strong>
                          <small>{dayTasks.length}</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="agenda-mini">
                    {selectedDayTasks.slice(0, 4).map((task) => (
                      <div key={task.id} className="agenda-mini-item">
                        <span className={`urgency-pill ${getUrgency(task).tone}`}>{getUrgency(task).label}</span>
                        <div>
                          <strong>{task.title}</strong>
                          <p>{projectById[task.projectId].name}</p>
                        </div>
                      </div>
                    ))}
                    {selectedDayTasks.length === 0 && <p className="empty-copy">Nothing scheduled here yet.</p>}
                  </div>
                </section>
              </aside>
            </section>
          </section>
        )}

        {view === "projects" && (
          <section className="projects-screen">
            <header className="projects-header">
              <p className="kicker">Portfolio Overview</p>
              <h2>Your active curation.</h2>
            </header>

            {lastSavedTaskId && <div className="success-banner">Voice task saved into {projectById[selectedProjectId].name}.</div>}

            <section className="project-bento">
              {projects.map((project, index) => {
                const open = tasks.filter((task) => task.projectId === project.id && task.status !== "done");
                const done = tasks.filter((task) => task.projectId === project.id && task.status === "done").length;
                return (
                  <button
                    key={project.id}
                    className={`bento-card ${index === 0 ? "featured" : ""} ${selectedProjectId === project.id ? "selected" : ""}`}
                    onClick={() => setSelectedProjectId(project.id)}
                    style={{ "--project-accent": project.color } as React.CSSProperties}
                  >
                    <div className="bento-meta">
                      <span className="chip">{project.type}</span>
                      <div className="metric">
                        <strong>
                          {done}/{tasks.filter((task) => task.projectId === project.id).length}
                        </strong>
                        <small>tasks done</small>
                      </div>
                    </div>
                    <h3>{project.name}</h3>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.max(
                            10,
                            Math.round(
                              (done / Math.max(1, tasks.filter((task) => task.projectId === project.id).length)) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="bento-list">
                      {open.slice(0, 2).map((task) => (
                        <div key={task.id} className="bento-list-item">
                          <span>{task.title}</span>
                          <small>{getUrgency(task).label}</small>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </section>

            <section className="project-detail">
              <div className="detail-heading">
                <div>
                  <p className="kicker">Active Project</p>
                  <h2>{selectedProject.name}</h2>
                </div>
                <button className="ghost-button" onClick={() => setView("capture")}>
                  New Task
                </button>
              </div>

              <ProjectSection title="Blocked" tone="urgent" tasks={groupedProjectTasks.blocked} project={selectedProject} onCycleStatus={cycleStatus} />
              <ProjectSection title="In Progress" tone="default" tasks={groupedProjectTasks.progress} project={selectedProject} onCycleStatus={cycleStatus} />
              <ProjectSection title="Pending" tone="muted" tasks={groupedProjectTasks.pending} project={selectedProject} onCycleStatus={cycleStatus} />
              {groupedProjectTasks.completed.length > 0 && (
                <ProjectSection title="Completed" tone="faded" tasks={groupedProjectTasks.completed} project={selectedProject} onCycleStatus={cycleStatus} />
              )}
            </section>
          </section>
        )}

        {view === "capture" && (
          <section className="capture-screen">
            <div className="capture-stage">
              <div className="transcript-block">
                <p className="transcript-quote">
                  {captureInput
                    ? `“${captureInput}”`
                    : isRecording
                      ? "“Listening for your task update…”"
                      : "“Call John tomorrow about Flywheel proposal at 2 PM”"}
                </p>
                <div className="listening-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="capture-actions">
                {!isRecording ? (
                  <button className="mic-button" onClick={startRecording} disabled={isParsing}>
                    <span className="material-symbols-outlined fill-icon">mic</span>
                  </button>
                ) : (
                  <button className="mic-button recording" onClick={stopRecording}>
                    <span className="material-symbols-outlined fill-icon">stop</span>
                  </button>
                )}
                <div className="capture-button-row">
                  <button className="ghost-button" onClick={parseCapture} disabled={isParsing}>
                    {isParsing ? "Parsing..." : "Parse update"}
                  </button>
                  {audioBlob && <span className="audio-ready">Audio captured</span>}
                </div>
              </div>

              <div className="capture-input-shell">
                <textarea
                  value={captureInput}
                  onChange={(event) => setCaptureInput(event.target.value)}
                  placeholder="Type what you want to say, or record audio, then parse it with Gemini..."
                />
              </div>

              {parseError && <div className="error-banner">{parseError}</div>}

              <div className="chip-row">
                <CaptureChip icon="folder" label={`Project: ${reviewDraft?.projectName ?? "Unknown"}`} tone="secondary" />
                <CaptureChip icon="event" label={reviewDraft?.dueDate ?? "No due date"} tone="default" />
                <CaptureChip icon="priority_high" label={`Priority: ${(reviewDraft?.priority ?? "medium").toUpperCase()}`} tone="urgent" />
                <CaptureChip icon="task" label={`Status: ${statusLabel[reviewDraft?.status ?? "inbox"]}`} tone="soft" />
              </div>

              <p className="processing-copy">
                <span className="processing-dot" />
                {parseResult?.provider === "gemini"
                  ? "Gemini parsed your update"
                  : parseResult?.provider === "local-fallback"
                    ? "Local fallback parser active"
                    : "AI is waiting for your update"}
              </p>

              {parseResult && reviewDraft && (
                <section className="review-card">
                  <div className="review-head">
                    <div>
                      <h3>Review parsed task</h3>
                      <p>
                        Provider: {parseResult.provider} · Confidence: {Math.round(reviewDraft.confidence * 100)}%
                      </p>
                    </div>
                    {reviewDraft.needsReview && <span className="urgency-pill soon">Review recommended</span>}
                  </div>

                  {parseResult.warnings.length > 0 && (
                    <div className="warning-stack">
                      {parseResult.warnings.map((warning) => (
                        <p key={warning} className="warning-text">
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="review-grid">
                    <label>
                      <span>Transcript</span>
                      <textarea
                        value={reviewDraft.transcript}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, transcript: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Task title</span>
                      <input
                        value={reviewDraft.title}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, title: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Project</span>
                      <select
                        value={reviewDraft.projectId ?? ""}
                        onChange={(event) => {
                          const projectId = event.target.value || null;
                          setReviewDraft({
                            ...reviewDraft,
                            projectId,
                            projectName: projectId ? projectById[projectId].name : null,
                          });
                        }}
                      >
                        <option value="">Needs review</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={reviewDraft.status}
                        onChange={(event) =>
                          setReviewDraft({ ...reviewDraft, status: event.target.value as VoiceTaskDraft["status"] })
                        }
                      >
                        <option value="inbox">Inbox</option>
                        <option value="next">Next</option>
                        <option value="in-progress">In Progress</option>
                        <option value="waiting">Waiting</option>
                        <option value="blocked">Blocked</option>
                        <option value="delegated">Delegated</option>
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={reviewDraft.priority}
                        onChange={(event) =>
                          setReviewDraft({ ...reviewDraft, priority: event.target.value as TaskPriority })
                        }
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <label>
                      <span>Due date</span>
                      <input
                        type="date"
                        value={reviewDraft.dueDate ?? ""}
                        onChange={(event) => setReviewDraft({ ...reviewDraft, dueDate: event.target.value || null })}
                      />
                    </label>
                    <label className="full-width">
                      <span>Dependency / waiting on</span>
                      <input
                        value={reviewDraft.dependencyLabel ?? ""}
                        onChange={(event) =>
                          setReviewDraft({ ...reviewDraft, dependencyLabel: event.target.value || null })
                        }
                      />
                    </label>
                  </div>

                  <div className="review-actions">
                    <button className="ghost-button" onClick={() => setParseResult(null)}>
                      Clear
                    </button>
                    <button className="primary-action" onClick={saveReviewedTask}>
                      Save task
                    </button>
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {view === "calendar" && (
          <section className="calendar-screen">
            <header className="calendar-header">
              <div>
                <h2>March 2026</h2>
                <p>{tasks.filter((task) => task.status !== "done").length} tasks remaining this week</p>
              </div>
              <div className="calendar-actions">
                <button className="circle-button">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="circle-button">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </header>

            <div className="calendar-strip">
              {weekDates.map((date) => {
                const dateKey = isoDate(date);
                const dayTasks = tasks.filter((task) => task.dueDate === dateKey || task.scheduledDate === dateKey);
                return (
                  <button
                    key={dateKey}
                    className={`calendar-pill-card ${selectedDate === dateKey ? "active" : ""}`}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <span>{date.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                    <strong>{date.getDate()}</strong>
                    {dayTasks.length > 0 && <i />}
                  </button>
                );
              })}
            </div>

            <div className="agenda-timeline">
              {selectedDayTasks.map((task, index) => (
                <div key={task.id} className={`timeline-block ${getUrgency(task).tone}`}>
                  <div className="timeline-marker" />
                  <span className="timeline-time">{task.scheduledDate === selectedDate ? "Scheduled" : "Due"}</span>
                  <div className="timeline-card">
                    <div className="timeline-card-meta">
                      <span className={`chip chip-${task.projectId}`}>{projectById[task.projectId].name}</span>
                      <span>{index === 0 ? "90 min" : task.effort}</span>
                    </div>
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                  </div>
                </div>
              ))}
              {selectedDayTasks.length === 0 && <p className="empty-copy">No tasks scheduled for this day.</p>}
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-bubble ${view === item.id ? "active" : ""} ${item.id === "capture" ? "capture" : ""}`}
            onClick={() => setView(item.id)}
          >
            <span className="material-symbols-outlined">{item.icon === "tally" ? "list_alt" : item.icon}</span>
            {view !== item.id && item.id !== "capture" && <small>{item.label}</small>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <header className="top-bar">
      <div className="avatar" />
      <h1>{title}</h1>
      <button className="icon-button">
        <span className="material-symbols-outlined">search</span>
      </button>
    </header>
  );
}

function ProgressRing({ value }: { value: number }) {
  const dashArray = 175.9;
  const dashOffset = dashArray - (dashArray * value) / 100;

  return (
    <div className="progress-ring">
      <svg viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="28" className="track" />
        <circle cx="36" cy="36" r="28" className="fill" style={{ strokeDasharray: dashArray, strokeDashoffset: dashOffset }} />
      </svg>
      <div>{value}%</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  tone: "urgent" | "neutral";
  icon: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-card-row">
        <span className="material-symbols-outlined">{icon}</span>
        <small>{label}</small>
      </div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <p>{note}</p>
    </article>
  );
}

function TaskRow({
  task,
  project,
  onCycleStatus,
}: {
  task: Task;
  project: Project;
  onCycleStatus: (taskId: string) => void;
}) {
  const urgency = getUrgency(task);

  return (
    <div className="task-row" style={{ "--project-accent": project.color } as React.CSSProperties}>
      <button className="task-check" onClick={() => onCycleStatus(task.id)} />
      <div className="task-copy">
        <div className="task-title-row">
          <strong>{task.title}</strong>
          <span className={`urgency-pill ${urgency.tone}`}>{urgency.label}</span>
        </div>
        <div className="task-submeta">
          {task.dependencyLabel && <span>{task.dependencyLabel}</span>}
          {!task.dependencyLabel && <span>{statusLabel[task.status]}</span>}
          <span>{formatDate(task.dueDate)}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectSection({
  title,
  tone,
  tasks,
  project,
  onCycleStatus,
}: {
  title: string;
  tone: "urgent" | "default" | "muted" | "faded";
  tasks: Task[];
  project: Project;
  onCycleStatus: (taskId: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <section className={`project-section ${tone}`}>
      <div className="section-head">
        <h3>{title}</h3>
        <span>{tasks.length} Items</span>
      </div>
      <div className="section-cards">
        {tasks.map((task) => (
          <div key={task.id} className={`project-task-card ${task.status === "done" ? "done" : ""}`}>
            <div className="project-task-top">
              <div>
                {task.dependencyLabel && <p className="overline">{task.dependencyLabel}</p>}
                <h4>{task.title}</h4>
              </div>
              <span className={`urgency-pill ${getUrgency(task).tone}`}>{getUrgency(task).label}</span>
            </div>
            <div className="project-task-meta">
              <span>{formatDate(task.dueDate)}</span>
              <span>{project.name}</span>
              <span>{task.owner}</span>
            </div>
            <button className="ghost-button" onClick={() => onCycleStatus(task.id)}>
              Advance
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaptureChip({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: "secondary" | "default" | "urgent" | "soft";
}) {
  return (
    <div className={`capture-chip ${tone}`}>
      <span className="material-symbols-outlined">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default App;
