# Food Chain — Ecosystem Builder + AI Coach

A visual ecosystem builder with an AI-powered multi-agent chatbot coach.

---

## Quick Start

### 1. Start Ollama

```bash
ollama serve
```

### 2. Pull the model

```bash
ollama pull qwen2.5:3b
```

> The model name in `.env` is `qwen2.5:3b`. If you want to use a different model,
> update `VITE_OLLAMA_MODEL` in `.env` and restart the dev server.

### 3. Run the app

```bash
cd food-chain
npm install
npm run dev
```

Open **http://localhost:5173/coach** for the chatbot.

---

## Environment Variables

Edit `food-chain/.env`:

| Variable | Default | Description |
|---|---|---|
| `VITE_LLM_PROVIDER` | `ollama` | `ollama` or `mock` |
| `VITE_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `VITE_OLLAMA_MODEL` | `qwen2.5:3b` | Model name |
| `VITE_LLM_TEMPERATURE` | `0.4` | Response creativity (0–1) |
| `VITE_LLM_TIMEOUT_MS` | `60000` | Request timeout in ms |

---

## Switching Models

1. Pull the new model: `ollama pull <model-name>`
2. Update `.env`: `VITE_OLLAMA_MODEL=<model-name>`
3. Restart: `npm run dev`

Tested models: `qwen2.5:3b`, `llama3.2:3b`, `mistral:7b`, `phi3:mini`

---

## How Fallback Works

If Ollama is unreachable or returns an error:
1. `llmService.js` catches the error
2. Falls back to `mockResponse()` — a deterministic template response
3. The UI shows "Mock mode (Ollama offline)" in the sidebar
4. The app never crashes

To force mock mode: set `VITE_LLM_PROVIDER=mock` in `.env`.

---

## Data Flow

```
User types message
       ↓
CoachPage.jsx  →  sendChatMessage()
       ↓
chatApi.js  →  handleChatRequest()
       ↓
chatService.js  →  orchestrate()
       ↓
orchestrator.js
  ├── detectIntents()
  ├── buildRagContext()        ← keyword search over knowledge docs
  ├── getMemory()              ← in-memory user history
  └── runs agents in parallel:
       ├── memoryAgent.js      ← syncs canvas species, recalls history
       ├── plantPlanningAgent.js  → generateResponse() → Ollama
       ├── sustainabilityAgent.js → generateResponse() → Ollama
       ├── biodiversityAgent.js   → generateResponse() → Ollama
       └── diagnosisAgent.js      → generateResponse() → Ollama
       ↓
  mergeAgentOutputs()          ← Decision Engine
       ↓
  llmCoach.js  →  generateResponse() → Ollama  ← final synthesis
       ↓
  buildCoachResponse()         ← structured CoachResponse
       ↓
CoachPage.jsx renders:
  - Main message bubble
  - ResponseCard (scores, recommendations, diagnosis, next actions)
```

---

## Routes

| URL | Page |
|---|---|
| `/` | Homepage (globe) |
| `/coach` | Ecosystem Coach chatbot |
| `/builder` | Visual ecosystem canvas |
| `/dashboard` | Project dashboard |

---

## Architecture

All code runs in the browser (Vite + React). The "backend" agents are plain
JavaScript modules imported directly — no server required for development.

To add a real server: wrap `handleChatRequest` in an Express/Fastify route
and update `chatApi.js` to use `fetch('/api/chat')` instead of the direct import.
