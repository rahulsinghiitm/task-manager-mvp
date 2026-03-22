import express from "express";
import multer from "multer";
import { parseVoiceTask } from "./gemini";
import { projects } from "../src/data";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const port = Number(process.env.PORT ?? 8787);

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post("/api/voice-task/parse", upload.single("audio"), async (request, response) => {
  try {
    const transcriptHint = typeof request.body.transcript === "string" ? request.body.transcript : "";
    const audioFile = request.file;

    if (!transcriptHint.trim() && !audioFile) {
      response.status(400).json({ error: "Provide either audio or transcript text." });
      return;
    }

    const result = await parseVoiceTask({
      transcriptHint,
      audioBase64: audioFile?.buffer.toString("base64"),
      audioMimeType: audioFile?.mimetype,
      projects: projects.map((project) => ({ id: project.id, name: project.name })),
      todayIsoDate: request.body.todayIsoDate || "2026-03-22",
      timezone: request.body.timezone || "Asia/Kolkata",
    });

    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parsing failure.";
    response.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Voice capture API listening on http://localhost:${port}`);
});
