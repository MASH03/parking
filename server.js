// server.js
// Standalone API Gateway, WebSocket Server & Frontend Host for Parking Agentic AI Factory

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { store } from './database/store.js';
import { orchestrator } from './agents/orchestrator/orchestrator.js';
import { ToolRegistry } from './tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/public')));

// WebSocket broadcast helper
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Hook store events directly into WebSocket broadcast
store.subscribe((event, payload) => {
  broadcast(event, payload);
});

// --- REST API ENDPOINTS ---

// 1. AI Orchestrator Chat Ingress
app.post('/api/v1/orchestrator/chat', async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: 'Message field is required.' });

  try {
    const trace = await orchestrator.processUserRequest(message, context || {});
    res.json(trace);
  } catch (err) {
    console.error('Orchestrator error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Parking Slots Live State
app.get('/api/v1/parking/slots', (req, res) => {
  res.json({
    total: store.parking_slots.length,
    slots: store.parking_slots
  });
});

// 3. Toggle Slot Status (Sensor / Hardware Simulation)
app.post('/api/v1/parking/slots/toggle', (req, res) => {
  const { slot_id, status } = req.body;
  const slot = store.parking_slots.find(s => s.slot_id === slot_id);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  slot.status = status || (slot.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE');
  store.notify('SLOT_UPDATED', slot);
  res.json({ success: true, slot });
});

// 4. Reservations List
app.get('/api/v1/reservations', (req, res) => {
  res.json(store.reservations);
});

// 5. Agent Trace & Audit Logs
app.get('/api/v1/logs/agent', (req, res) => {
  res.json(store.agent_logs.slice(0, 50));
});

// 6. Security Logs
app.get('/api/v1/logs/security', (req, res) => {
  res.json(store.security_logs);
});

// 7. Analytics Dashboard Metrics
app.get('/api/v1/analytics/metrics', async (req, res) => {
  const report = await ToolRegistry.GenerateParkingReport({});
  res.json(report);
});

// 8. Human-in-the-Loop (HITL) Queue
app.get('/api/v1/hitl/pending', (req, res) => {
  res.json(store.hitl_requests);
});

// 9. Approve / Reject HITL Action
app.post('/api/v1/hitl/approve', (req, res) => {
  const { hitl_id, approved, admin_notes } = req.body;
  const item = store.hitl_requests.find(h => h.hitl_id === hitl_id);
  if (!item) return res.status(404).json({ error: 'HITL request not found' });

  item.status = approved ? 'APPROVED' : 'REJECTED';
  item.admin_notes = admin_notes || 'Handled by Admin Console';
  item.resolved_at = new Date().toISOString();

  store.notify('HITL_RESOLVED', item);
  res.json({ success: true, item });
});

// 10. Database Store Reset
app.post('/api/v1/reset', (req, res) => {
  store.reset();
  broadcast('STORE_RESET', { message: 'Database reset to default seed state' });
  res.json({ success: true, message: 'Store reset completed' });
});

// Fallback to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/index.html'));
});

// Start Server with dynamic fallback if port is in use
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n=======================================================`);
    console.log(`🚀 Parking System Agentic AI Factory is LIVE!`);
    console.log(`👉 Open Web Console:   http://localhost:${port}`);
    console.log(`⚡ WebSocket Stream:   ws://localhost:${port}/ws`);
    console.log(`🧠 AI Orchestrator:    Online (10 Specialized Agents)`);
    console.log(`🛠️ Tool Permission Matrix: 17 Deterministic Tools Active`);
    console.log(`=======================================================\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is currently in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);

