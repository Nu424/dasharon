# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

**だしゃろん (dasharon)** is a frontend-only React + Vite app. Voice input is transcribed and summarized into Markdown memos via the OpenRouter API. There is no backend, database, or Docker in this repo.

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Vite dev server | `npm run dev` | 5173 | Primary local development target |
| Vite preview | `npm run preview` | 4173 | Serves production build after `npm run build` |

Only the Vite dev server is required for local UI development. OpenRouter is an external SaaS dependency for STT/LLM; the API key is entered in the in-app Settings UI and stored in `localStorage`, not in repo env vars.

### Standard commands

See `README.md` and `package.json` scripts:

- **Install deps:** `npm install`
- **Dev server:** `npm run dev` (add `-- --host 0.0.0.0` when serving from a cloud VM)
- **Lint:** `npm run lint`
- **Build:** `npm run build`
- **Preview:** `npm run preview`

There is no test suite configured in this repo.

### Lint caveat

`npm run lint` currently reports pre-existing ESLint issues in `AudioManager.ts`, `ImageManager.ts`, `util.ts`, and `vite.config.ts`. `npm run build` succeeds despite these.

### End-to-end testing notes

Full voice → STT → LLM flow requires:

1. A valid OpenRouter API key (Settings → API)
2. Microphone permission in the browser (Chrome recommended)
3. Network access to `openrouter.ai` (and jsDelivr CDN if using VAD mode)

Without an API key, verify the environment by loading `http://localhost:5173`, opening Settings, and toggling Edit mode on the memo pane.

### Dev server startup

Use tmux for long-running dev servers in cloud VMs:

```bash
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s vite-dev-server -c /workspace -- zsh -l
tmux -f /exec-daemon/tmux.portal.conf send-keys -t vite-dev-server:0.0 'npm run dev -- --host 0.0.0.0' C-m
```
