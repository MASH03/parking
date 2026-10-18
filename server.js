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

// 1. AI Orchestrator Chat Ingress (Legacy multi-agent engine compatibility)
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

// 1.1 Real Customer Service Live Desk Ingress
app.get('/api/v1/support/overview', (req, res) => {
  res.json({
    staff: store.support_staff || [],
    tickets: store.support_tickets || [],
    messages: store.service_messages || []
  });
});

// 1.2 Send Message to Real Customer Service Attendant
app.post('/api/v1/support/message', async (req, res) => {
  const { message, user_name, vehicle_plate } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const customerMsg = {
    id: `csm-${Date.now()}-user`,
    sender: 'user',
    user_name: user_name || 'Customer / Driver',
    vehicle_plate: vehicle_plate || 'NY-8821',
    text: message,
    timestamp: new Date().toISOString()
  };
  store.addSupportMessage(customerMsg);

  const lower = message.toLowerCase();
  let staffReplyText = '';
  let actionsTaken = [];
  let assignedStaff = store.support_staff[0] || { name: 'Carlos Ramos', role: 'Head Parking Attendant', avatar: '👨‍💼', location: 'Ground Booth B-1' };

  if (lower.includes('gate') || lower.includes('barrier') || lower.includes('stuck') || lower.includes('open') || lower.includes('exit')) {
    // Attendant lifts gate
    const gateId = lower.includes('south') ? 'GATE-SOUTH-1' : 'GATE-NORTH-1';
    store.security_logs.unshift({
      security_log_id: `sec-${Date.now()}`,
      vehicle_id: null,
      camera_id: gateId,
      event_type: 'ATTENDANT_OVERRIDE',
      severity: 'WARNING',
      description: `Attendant Carlos Ramos remotely raised ${gateId} barrier arm for customer vehicle (${vehicle_plate || 'NY-8821'}).`,
      timestamp: new Date().toISOString()
    });
    store.notify('SECURITY_LOG_CREATED', store.security_logs[0]);

    staffReplyText = `Hello! Carlos Ramos here from the Ground Floor Attendant Booth. I verified your position on our ${gateId} live CCTV monitor. I have remotely raised the barrier arm for your vehicle. The lane is green — you may safely proceed. Have a wonderful day!`;
    actionsTaken.push(`Barrier Raised (${gateId})`);
  } else if (lower.includes('ev') || lower.includes('electric') || lower.includes('charger') || lower.includes('charging')) {
    const evSlots = store.parking_slots.filter(s => s.slot_type === 'EV' && s.status === 'AVAILABLE');
    const slotNames = evSlots.map(s => `Bay ${s.slot_number} (Floor ${s.floor_number})`).join(', ');
    staffReplyText = `Hi! Carlos here. We currently have ${evSlots.length} EV charging bays available: ${slotNames || 'none right now'}. All EV bays are equipped with Level 2 / 22kW CCS Type 2 plugs. If you are on Floor 2 and need technician help plugging in, our mobile technician Marcus Vance is stationed there right now!`;
    actionsTaken.push('EV Bay Sensor Verified');
  } else if (lower.includes('reserve') || lower.includes('book') || lower.includes('hold') || lower.includes('ny-8821') || lower.includes('f2-04')) {
    const targetSlot = store.parking_slots.find(s => s.slot_number === 'F2-04' || (s.status === 'AVAILABLE' && s.floor_number === 2)) || store.parking_slots[0];
    targetSlot.status = 'RESERVED';
    store.notify('SLOT_UPDATED', targetSlot);

    const newRes = {
      reservation_id: `res-${Math.floor(1000 + Math.random() * 9000)}`,
      user_id: 'usr-001',
      vehicle_id: 'veh-001',
      slot_id: targetSlot.slot_id,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
      qr_code_hash: `QR-LIVE-${targetSlot.slot_number}`,
      status: 'CONFIRMED',
      created_at: new Date().toISOString()
    };
    store.reservations.unshift(newRes);

    staffReplyText = `Done! I have personally reserved slot ${targetSlot.slot_number} on Floor ${targetSlot.floor_number} under plate ${vehicle_plate || 'NY-8821'}. Your reservation pass code is ${newRes.qr_code_hash}. The bay sensor will illuminate Blue for you upon arrival.`;
    actionsTaken.push(`Slot ${targetSlot.slot_number} Reserved`);
  } else if (lower.includes('refund') || lower.includes('dispute') || lower.includes('overcharge') || lower.includes('$5') || lower.includes('money')) {
    const refundId = `hitl-${Math.floor(100 + Math.random() * 900)}`;
    store.hitl_requests.unshift({
      hitl_id: refundId,
      type: 'REFUND_REQUEST',
      title: 'Customer Refund: Res #8812 Departure Sensor Overcharge',
      requested_by: 'Customer Service (Carlos Ramos)',
      amount: 5.00,
      user_id: 'usr-001',
      reason: 'Driver reported departure sensor delay at Gate North-1 exit.',
      status: 'PENDING',
      created_at: new Date().toISOString()
    });
    store.notify('HITL_REQUEST_ADDED', store.hitl_requests[0]);

    staffReplyText = `I sincerely apologize for the inconvenience with the sensor delay. I have generated a formal refund request of $5.00 under Reference #${refundId} and submitted it to our Duty Operations Manager Sarah Connor. You can see the request live in our Admin & HITL approvals queue.`;
    actionsTaken.push(`Refund Request #${refundId} Submitted`);
  } else if (lower.includes('rate') || lower.includes('cost') || lower.includes('fee') || lower.includes('price') || lower.includes('tariff') || lower.includes('hour')) {
    staffReplyText = `Our standard parking rates are $5.00/hour for standard sedan and SUV bays, and $6.25/hour for EV charging bays (which includes electricity consumption). We also offer a complimentary 15-minute grace period for drop-offs. Daily maximum is capped at $28.00.`;
  } else if (lower.includes('ada') || lower.includes('wheelchair') || lower.includes('accessible') || lower.includes('handicap')) {
    staffReplyText = `We have accessible ADA parking bays on Ground Floor (Bay G-05) right next to the elevator lobby and Ground Booth B-1. If you require physical wheelchair escort or ramp assistance, I would be delighted to step outside and assist you immediately!`;
    actionsTaken.push('ADA Ramp Access Verified');
  } else if (lower.includes('lost') || lower.includes('ticket') || lower.includes('qr')) {
    staffReplyText = `No stress at all! Our garage operates an automatic license plate recognition (ANPR) system. As long as we have your vehicle plate, you do not need the paper ticket. I can look up your entry timestamp or issue you a digital exit barcode.`;
    actionsTaken.push('ANPR Plate Lookup Active');
  } else {
    staffReplyText = `Thank you for reaching out to Grand Central Parking Customer Service! I've logged your request: "${message}". I am stationed here at Ground Booth B-1. If you need immediate in-person assistance, you can also use our 2-way Intercom or call our service desk at extension 101.`;
  }

  const staffMsg = {
    id: `csm-${Date.now()}-staff`,
    sender: 'staff',
    staff_name: assignedStaff.name,
    staff_role: assignedStaff.role,
    location: assignedStaff.location,
    avatar: assignedStaff.avatar,
    badge: 'Staff On Duty',
    text: staffReplyText,
    actions: actionsTaken,
    timestamp: new Date().toISOString()
  };
  store.addSupportMessage(staffMsg);

  res.json({
    success: true,
    user_message: customerMsg,
    staff_message: staffMsg,
    tickets: store.support_tickets,
    hitl_requests: store.hitl_requests
  });
});

// 1.3 Create New Support Ticket
app.post('/api/v1/support/tickets', (req, res) => {
  const { subject, category, priority, location, vehicle_plate, user_name, description } = req.body;
  if (!subject) return res.status(400).json({ error: 'Subject is required.' });

  const ticketId = `CST-${Math.floor(1000 + Math.random() * 9000)}`;
  const assigned = category === 'EV_CHARGER' 
    ? 'Marcus Vance (Field Tech)' 
    : category === 'BILLING_DISPUTE' 
    ? 'Sarah Connor (Duty Manager)' 
    : 'Carlos Ramos (Head Attendant)';

  const newTicket = {
    ticket_id: ticketId,
    user_name: user_name || 'Driver / Guest',
    vehicle_plate: vehicle_plate || 'NY-8821',
    location: location || 'Ground Booth B-1',
    category: category || 'GENERAL_INQUIRY',
    priority: priority || 'NORMAL',
    status: 'IN_PROGRESS',
    assigned_to: assigned,
    subject,
    description: description || subject,
    created_at: new Date().toISOString()
  };

  store.addSupportTicket(newTicket);

  // Also post an attendant notification message in chat
  store.addSupportMessage({
    id: `csm-${Date.now()}-ticket`,
    sender: 'staff',
    staff_name: 'Carlos Ramos',
    staff_role: 'Head Parking Attendant',
    location: 'Ground Booth B-1',
    avatar: '👨‍💼',
    badge: 'Ticket Created',
    text: `📋 Case #${ticketId} ("${subject}") has been officially logged in our customer service dispatch queue and assigned to ${assigned}. We are handling it with priority.`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, ticket: newTicket });
});

// 1.4 Simulate 2-Way Gate / Booth Intercom Call
app.post('/api/v1/support/intercom', (req, res) => {
  const { station } = req.body;
  const targetStation = station || 'Gate North-1 Intercom Kiosk';
  
  store.security_logs.unshift({
    security_log_id: `sec-${Date.now()}`,
    vehicle_id: null,
    camera_id: 'INTERCOM-STATION',
    event_type: 'INTERCOM_CALL',
    severity: 'INFO',
    description: `2-Way Intercom call connected between ${targetStation} and Ground Attendant Booth B-1 (Carlos Ramos).`,
    timestamp: new Date().toISOString()
  });
  store.notify('SECURITY_LOG_CREATED', store.security_logs[0]);

  res.json({
    success: true,
    status: 'CONNECTED',
    station: targetStation,
    attendant: 'Carlos Ramos',
    attendant_role: 'Head Parking Attendant',
    location: 'Ground Booth B-1',
    phone: '+1 (800) 555-PARK Ext 101',
    message: 'Intercom connected. Audio channel open with Ground Floor Attendant Booth B-1.'
  });
});

// 1.5 Attendant Remote Gate Barrier Override
app.post('/api/v1/support/gate-override', (req, res) => {
  const { gate_id, reason } = req.body;
  const gate = gate_id || 'GATE-NORTH-1';

  store.security_logs.unshift({
    security_log_id: `sec-${Date.now()}`,
    vehicle_id: null,
    camera_id: gate,
    event_type: 'ATTENDANT_REMOTE_LIFT',
    severity: 'WARNING',
    description: `Attendant Carlos Ramos remotely triggered barrier lift for ${gate}. Reason: ${reason || 'Attended driver verification'}.`,
    timestamp: new Date().toISOString()
  });
  store.notify('SECURITY_LOG_CREATED', store.security_logs[0]);

  res.json({
    success: true,
    gate,
    action: 'BARRIER_RAISED',
    attendant: 'Carlos Ramos',
    timestamp: new Date().toISOString()
  });
});

// 1.6 Dispatch Mobile Attendant
app.post('/api/v1/support/dispatch', (req, res) => {
  const { staff_name, target_floor, reason } = req.body;
  const attendant = store.support_staff.find(s => s.name === staff_name) || store.support_staff[2]; // Marcus Vance
  attendant.status = 'DISPATCHED';

  store.notify('STAFF_UPDATED', attendant);

  res.json({
    success: true,
    attendant: attendant.name,
    target: target_floor || 'Floor 2 EV Bay',
    status: 'DISPATCHED',
    eta: '2 minutes'
  });
});

// 1.7 Resolve Customer Service Ticket (Staff / Attendant Action)
app.post('/api/v1/support/resolve-ticket', (req, res) => {
  const { ticket_id, resolution_notes, resolved_by } = req.body;
  const ticket = store.support_tickets.find(t => t.ticket_id === ticket_id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  ticket.status = 'RESOLVED';
  ticket.resolved_at = new Date().toISOString();
  ticket.resolution_notes = resolution_notes || 'Resolved directly by on-duty attendant.';

  // Post resolution announcement to chat stream
  const resolutionMsg = {
    id: `csm-${Date.now()}-resolved`,
    sender: 'staff',
    staff_name: resolved_by || store.active_session?.name || 'Carlos Ramos',
    staff_role: 'Head Parking Attendant',
    location: 'Ground Booth B-1',
    avatar: '👨‍💼',
    badge: 'Case Resolved',
    text: `✅ Case #${ticket.ticket_id} ("${ticket.subject}") has been marked as RESOLVED by ${resolved_by || 'Staff Attendant'}. Notes: ${ticket.resolution_notes}`,
    actions: [`Case #${ticket.ticket_id} Closed`],
    timestamp: new Date().toISOString()
  };
  store.addSupportMessage(resolutionMsg);
  store.notify('SUPPORT_TICKET_UPDATED', ticket);

  res.json({ success: true, ticket, message: resolutionMsg });
});

// 1.8 Toggle Staff Duty Status
app.post('/api/v1/support/toggle-duty', (req, res) => {
  const { staff_id, status } = req.body;
  const staff = store.support_staff.find(s => s.staff_id === staff_id || s.id === staff_id || s.name === staff_id);
  if (!staff) return res.status(404).json({ error: 'Staff member not found' });

  staff.status = status || (staff.status === 'ON_DUTY' ? 'ON_BREAK' : 'ON_DUTY');
  if (store.active_session && store.active_session.staff_id === staff.staff_id) {
    store.active_session.status = staff.status;
  }
  store.notify('STAFF_UPDATED', staff);
  res.json({ success: true, staff });
});

// --- AUTHENTICATION & SESSION ENDPOINTS FOR CUSTOMER SERVICE ---

// Get Current Auth Session & Available Profiles
app.get('/api/v1/auth/session', (req, res) => {
  res.json({
    session: store.active_session,
    staff_roster: store.support_staff.map(s => ({
      id: s.id,
      staff_id: s.staff_id,
      name: s.name,
      role: s.role,
      location: s.location,
      status: s.status,
      phone: s.phone,
      avatar: s.avatar
    })),
    registered_drivers: store.users
      .filter(u => u.role === 'DRIVER')
      .map(u => {
        const veh = store.vehicles.find(v => v.user_id === u.user_id);
        return {
          user_id: u.user_id,
          name: u.name,
          plate: veh ? veh.plate_number : 'ABC-1234',
          model: veh ? `${veh.make_model} (${veh.vehicle_type})` : 'Sedan'
        };
      })
  });
});

// Log In as Driver or Staff Attendant
app.post('/api/v1/auth/login', (req, res) => {
  const { account_type, user_id, staff_id, pin, name, plate_number } = req.body;

  if (account_type === 'STAFF') {
    // Staff Attendant Login
    const staff = store.support_staff.find(
      s => s.staff_id === staff_id || s.id === user_id || s.name.toLowerCase() === (name || '').toLowerCase()
    ) || store.support_staff[0]; // fallback to Carlos Ramos

    // Verify PIN (default 1234)
    if (pin && pin !== staff.pin && pin !== '1234') {
      return res.status(401).json({ error: 'Incorrect Staff PIN. (Default demo PIN is 1234)' });
    }

    store.active_session = {
      is_authenticated: true,
      account_type: 'STAFF',
      staff_id: staff.staff_id,
      user_id: staff.id,
      name: staff.name,
      role: staff.role,
      location: staff.location,
      phone: staff.phone,
      avatar: staff.avatar,
      status: staff.status
    };

    // Log security record
    store.security_logs.unshift({
      security_log_id: `sec-${Date.now()}`,
      camera_id: 'STAFF-AUTH-PORTAL',
      event_type: 'STAFF_LOGIN',
      severity: 'INFO',
      description: `Staff Operator ${staff.name} (${staff.staff_id}) logged into Customer Service Desk.`,
      timestamp: new Date().toISOString()
    });
    store.notify('SECURITY_LOG_CREATED', store.security_logs[0]);
    store.notify('AUTH_SESSION_CHANGED', store.active_session);

    return res.json({ success: true, session: store.active_session });
  } else {
    // Driver / Customer Login
    let driverName = name;
    let driverPlate = plate_number;
    let driverId = user_id || 'usr-custom';

    if (user_id) {
      const matchedUser = store.users.find(u => u.user_id === user_id);
      if (matchedUser) {
        driverName = matchedUser.name;
        const matchedVeh = store.vehicles.find(v => v.user_id === matchedUser.user_id);
        if (matchedVeh) driverPlate = matchedVeh.plate_number;
      }
    }

    store.active_session = {
      is_authenticated: true,
      account_type: 'CUSTOMER',
      user_id: driverId,
      name: driverName || 'Alex Johnson',
      vehicle_plate: driverPlate || 'ABC-1234',
      role: 'DRIVER',
      avatar: '🏎️',
      location: 'Ground Deck'
    };

    store.notify('AUTH_SESSION_CHANGED', store.active_session);
    return res.json({ success: true, session: store.active_session });
  }
});

// Logout Session (Return to Guest Driver)
app.post('/api/v1/auth/logout', (req, res) => {
  store.active_session = {
    is_authenticated: false,
    account_type: 'CUSTOMER',
    user_id: 'usr-guest',
    name: 'Guest Driver',
    vehicle_plate: 'NY-8821',
    role: 'DRIVER',
    avatar: '🚗',
    location: 'Ground Level'
  };

  store.notify('AUTH_SESSION_CHANGED', store.active_session);
  res.json({ success: true, session: store.active_session });
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

