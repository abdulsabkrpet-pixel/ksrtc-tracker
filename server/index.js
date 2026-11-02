const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const trackingEngine = require('./services/trackingEngine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// REST Endpoints
app.get('/api/routes', (req, res) => {
  res.json(trackingEngine.getRoutes());
});

app.get('/api/routes/:id', (req, res) => {
  const route = trackingEngine.getRoute(req.params.id);
  if (!route) return res.status(404).json({ error: 'Route not found' });
  res.json(route);
});

app.get('/api/stops', (req, res) => {
  res.json(trackingEngine.getStops());
});

app.get('/api/timetables', (req, res) => {
  try {
    const timetables = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/timetables.json'), 'utf8'));
    res.json(timetables);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load timetables' });
  }
});

app.get('/api/buses', (req, res) => {
  res.json(trackingEngine.getBuses());
});

app.get('/api/buses/:id', (req, res) => {
  const bus = trackingEngine.getBus(req.params.id);
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  res.json(bus);
});

// Telemetry ingestion endpoint for Drivers or external GPS feeds
app.post('/api/telemetry', (req, res) => {
  const { busId, lat, lon, speed, heading, driverName } = req.body;
  if (!busId || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'Missing required telemetry fields: busId, lat, lon' });
  }

  const updatedBus = trackingEngine.updateBusTelemetry(busId, {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    speed: speed !== undefined ? parseFloat(speed) : undefined,
    heading: heading !== undefined ? parseFloat(heading) : undefined,
    driverName
  });

  res.json({ success: true, bus: updatedBus });
});

// Toggle simulator mode
app.post('/api/simulator/toggle', (req, res) => {
  const { enable } = req.body || {};
  const active = trackingEngine.toggleSimulator(enable);
  res.json({ simulatorActive: active });
});

// System Status
app.get('/api/status', (req, res) => {
  res.json({
    name: 'KSRTC Real-Time Tracking Engine',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    activeBuses: trackingEngine.getBuses().length,
    simulatorActive: trackingEngine.simulatorActive,
    connectedClients: wss.clients.size
  });
});

// Real-Time WebSocket Streaming Hub
wss.on('connection', (ws) => {
  console.log(`[WebSocket] Client connected. Total active clients: ${wss.clients.size}`);

  // Send initial payload with full system state
  ws.send(JSON.stringify({
    type: 'INIT',
    timestamp: new Date().toISOString(),
    buses: trackingEngine.getBuses(),
    routes: trackingEngine.getRoutes(),
    stops: trackingEngine.getStops()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      } else if (data.type === 'DRIVER_TELEMETRY') {
        trackingEngine.updateBusTelemetry(data.busId, data);
      }
    } catch (e) {
      console.error('Invalid WS message:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected. Total active clients: ${wss.clients.size}`);
  });
});

// Broadcast high-frequency bus updates to all connected frontend clients
trackingEngine.onUpdate((buses) => {
  const payload = JSON.stringify({
    type: 'BUS_UPDATE',
    timestamp: new Date().toISOString(),
    buses
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(payload);
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚍 KSRTC "Where is My Bus" Real-Time Server running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🗺️  Map View: http://localhost:${PORT}/index.html`);
  console.log(`🧑‍✈️ Driver Portal: http://localhost:${PORT}/driver.html`);
  console.log(`====================================================`);
});
