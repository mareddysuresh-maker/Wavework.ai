/**
 * ClickUp FlowUp Core Express.js Backend Server
 * Bundled with modular controllers, routers, middlewares, and services
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

import usersRoutes from './routes/users.js';
import tasksRoutes from './routes/tasks.js';
import chatsRoutes from './routes/chats.js';
import inboxRoutes from './routes/inbox.js';
import formsRoutes from './routes/forms.js';
import notesRoutes from './routes/notes.js';

import { requireAuth } from "./middleware/auth.js";
import { calculateMetricsState } from "./controllers/tasksController.js";
import { chatsController } from "./controllers/chatsController.js";
import { initSocket } from "./services/socketService.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware trigger interceptor for writes to broadcast updates
app.use((req, res, next) => {
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  res.on("finish", () => {
    if (isWrite && res.statusCode >= 200 && res.statusCode < 300) {
      broadcastMetricsUpdate();
    }
  });
  next();
});

// API Domain Modules Registration
app.use('/api', usersRoutes);
app.use('/api', tasksRoutes);
app.use('/api', chatsRoutes);
app.use('/api', inboxRoutes);
app.use('/api', formsRoutes);
app.use('/api', notesRoutes);

// Serves attachments and docs locally
chatsController.injectUploadsStatic(app);

// Global SSE connection tracking for real-time dashboard triggers
let activeSseClients = [];
let sseClientId = 0;

export function broadcastMetricsUpdate() {
  calculateMetricsState().then((metrics) => {
    activeSseClients.forEach((client) => {
      try {
        client.res.write(`data: ${JSON.stringify(metrics)}\n\n`);
      } catch (e) {
        // stale client
      }
    });
  }).catch((e) => console.error("Broadcast calculation failed:", e));
}

// Live Dashboard Stats SSE Endpoint
app.get("/api/dashboard/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = ++sseClientId;
  const clientObj = { id: clientId, res };
  activeSseClients.push(clientObj);

  calculateMetricsState().then((metrics) => {
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  }).catch((e) => console.error("Initial SSE stats fetch failed:", e));

  // Regular heartbeat ping (every 15 seconds) to prevent Cloud Run/Vercel/Nginx proxy idle timeout
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: sse heartbeat ping\n\n`);
    } catch (err) {
      // Swallowed safely
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatInterval);
    activeSseClients = activeSseClients.filter((c) => c.id !== clientId);
  });
});

// Fallback Asset Server routing
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Vite development server initiating...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Production static files server initiating...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ClickUp FlowUp core system deployed. Listening on http://localhost:${PORT}`);
  });

  initSocket(server);
}

initializeServer();
