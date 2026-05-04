# Food Chain — A Field Guide to Ecosystems

Design realistic food webs by dragging species onto a canvas. Pick a city and the app seeds your ecosystem with real species observed nearby, sourced from iNaturalist and GBIF.

**Live demo:** https://eco.collinw.us

---

## Stack

- **Frontend:** React 18 + Vite, React Router v6, Three.js
- **Backend:** Hono (Node.js), iNaturalist / GBIF / GloBI / Nominatim APIs
- **AI:** Ollama (local) for the Ecosystem Coach chat, Groq (cloud) for ecosystem analysis

---

## Local Setup

### Prerequisites

- Node.js 18+
- Git

### 1. Clone and install

```bash
git clone https://github.com/CollinWentzien/kiro-hacks.git
cd kiro-hacks/food-chain
npm install
```

### 2. Environment variables

Create a `.env` file in `food-chain/`:

```env
# "Improve Ecosystem" button — free at console.groq.com
VITE_GROQ_API_KEY=your_groq_key_here

# Ecosystem Coach chat — requires Ollama running locally
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=qwen2.5:3b
```

Both are optional — the app works without them (AI features will show "this feature is currently unavailable").

### 3. Run

Open two terminals:

```bash
# Terminal 1 — backend (port 3000)
npm start

# Terminal 2 — frontend (port 5173)
npm run dev
```

Open http://localhost:5173

---

## AI Features

### "Improve Ecosystem" button — Groq (cloud, free)

Analyzes your canvas and returns species recommendations and a health score.

1. Get a free key at https://console.groq.com
2. Add `VITE_GROQ_API_KEY=your_key` to `.env`
3. Restart `npm run dev`

### Ecosystem Coach chat (`/coach`) — Ollama (local)

A full chat interface powered by a local LLM. Fully offline, no API key needed.

1. Install Ollama from https://ollama.com
2. Pull the model: `ollama pull qwen2.5:3b`
3. Start Ollama: `ollama serve`
4. Add `VITE_OLLAMA_BASE_URL=http://localhost:11434` to `.env`
5. Restart `npm run dev`

---

## Deploy to a Server

### Prerequisites on the server

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Static file server
npm install -g serve
```

### Configure deploy settings

Edit `food-chain/deploy.env`:

```env
PI_USER=your_ssh_user
PI_HOST=your-server.com
PI_DIR=/home/youruser/food-chain

BACKEND_PORT=3001
FRONTEND_PORT=8080

VITE_GROQ_API_KEY=your_groq_key_here
```

### Run the deploy script

From Git Bash or WSL:

```bash
bash food-chain/deploy.sh
```

This will:
1. Build the frontend
2. Rsync all files to the server (excluding `node_modules`, `.env`, caches)
3. Install production dependencies on the server
4. Start the backend on `BACKEND_PORT` and frontend on `FRONTEND_PORT`

### nginx (optional)

To serve on port 80/443 without exposing app ports, add a server block:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Then get an SSL cert:

```bash
sudo certbot --nginx -d your-domain.com
```

---

## Project Structure

```
food-chain/
├── index.js              # Hono backend entry (port 3000)
├── routes/               # API routes (ecosystem, geocode, catalog...)
├── services/             # Species data, trophic classification, caching
├── src/
│   ├── pages/            # HomePage, EcosystemBuilder, CoachPage, VisionPage
│   ├── components/       # Canvas, sidebar, health panel, chat
│   ├── data/             # API client, species data, AI helpers
│   └── backend/          # AI orchestrator, agents, RAG knowledge base
├── deploy.env            # Deploy config (not committed)
└── deploy.sh             # Deploy script
```

---

## Contributors

- **Collin** — frontend, canvas, backend integration, AI wiring
- **Taren** — backend API (species data, geocoding, trophic classification)
- **Prarthana** — AI coach system, accessibility, vision page
