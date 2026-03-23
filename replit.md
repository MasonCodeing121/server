# Cutter RPG Server

## Overview
A multiplayer game server and admin panel for "Cutter RPG." Provides real-time player communication via Socket.io and a web-based Admin Terminal for managing game state and players.

## Architecture
- **Runtime:** Node.js
- **Communication:** Socket.io v4 (WebSockets)
- **Frontend:** Plain HTML/CSS/JS (served statically from `index.html`)
- **No build step required** — runs directly with `node server.js`

## Project Structure
- `server.js` — Main entry point: HTTP static file server + Socket.io game/admin logic
- `index.html` — Admin Terminal UI (login, live player dashboard, admin controls)
- `package.json` — Dependencies (`socket.io`)

## Key Details
- Server listens on port **5000** (or `process.env.PORT`)
- CORS is open (`origin: "*"`) for Socket.io connections
- Admin password is hardcoded in `server.js` (`ADMIN_PASSWORD`)
- Player state is stored **in-memory** (lost on server restart)

## Running
```bash
npm start        # production
npm run dev      # development with auto-reload (Node 18+)
```

## Deployment
- Target: `vm` (always running, needed for persistent WebSocket state)
- Run command: `node server.js`
