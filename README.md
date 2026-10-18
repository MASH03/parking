# Parking System Agentic AI Factory

An intelligent, multi-agent automated parking management platform built with an **Agentic AI Factory Architecture**. A central **AI Orchestrator** coordinates 10 specialized, permission-scoped AI agents to manage parking operations, live IoT telemetry, ANPR computer vision, reservations, automated billing, security, and analytics.

---

## 🏛️ System Architecture

- **AI Orchestrator Agent**: Dynamic task decomposition, multi-agent planning, and validation.
- **10 Specialized Agents**:
  - `Availability Agent`: Real-time slot occupancy & sensor tracking.
  - `Reservation Agent`: Conflict-free booking lifecycle & QR issuance.
  - `Payment Agent`: Invoicing, dynamic pricing, and payment verification.
  - `Entry & Exit Agent`: Automated gate barrier control & ANPR logging.
  - `Security Agent`: Threat detection, blacklist check, & incident triage.
  - `Customer Support Agent`: Conversational assistant & FAQ resolution.
  - `Maintenance Agent`: IoT sensor & gate hardware diagnostics.
  - `Analytics Agent`: Occupancy forecasting & management reports.
  - `Notification Agent`: Multichannel push, email, and SMS alerts.

---

## 📁 Repository Structure

```
parking-ai-factory/
├── agents/               # AI Orchestrator & 10 Specialized Agents
│   ├── orchestrator/
│   ├── availability/
│   ├── reservation/
│   ├── payment/
│   ├── entry_exit/
│   ├── security/
│   ├── support/
│   ├── maintenance/
│   ├── analytics/
│   └── notification/
├── tools/                # Deterministic tool layer (APIs & Sandboxes)
├── backend/              # Core business services & WebSocket gateway
├── frontend/             # Driver App, Admin Dashboard, Attendant UI
├── database/             # PostgreSQL migrations & seed data
├── computer_vision/      # YOLOv8 & OpenCV ANPR pipeline
├── sensors/              # IoT ESP32 firmware & telemetry ingestion
├── docker/               # Docker Compose & multi-service containers
├── tests/                # Unit, integration, and E2E simulation suites
└── documentation/        # Authoritative system specification & diagrams
```

---

## 🚀 How to Run (1-Click or Terminal)

### Option A: 1-Click Launch (Windows)
Double-click **`start.bat`** in the project folder. It will start the server and automatically launch your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

### Option B: Terminal Command
```bash
npm start
```
*(Dynamic port fallback is built-in if port 3000 is occupied).*

---

## 🎮 Easy-to-Navigate Web Console (`http://localhost:3000`)

The interface features an intuitive **sidebar command layout** and interactive guides:

1. **🌟 30-Second Guided Tour**: Click the **"30-Sec Guided Tour"** button at the top of the sidebar for an automated walkthrough of all console tabs and features.
2. **🏢 Live Floor Map**:
   - Floor 1 (Ground), Floor 2 (Upper Deck), and **Floor 3 (Roof Deck)** with live count badges (e.g. *7/8 Free*).
   - Total facility capacity expanded to **24 slots**.
   - Filter chips to instantly isolate **Available Only**, **EV Charging**, or **Accessible (ADA)** spots.
   - Click any green slot to open the **1-Click Booking Dialog** with instant price calculations.
3. **🛎️ Live Customer Service Desk & Attendant Support**:
   - Live conversational assistance with on-duty parking attendants (Head Attendant Carlos Ramos, Customer Care Lead Elena Rostova, and Technician Marcus Vance).
   - Real-time resolution for gate lockouts, EV charger assistance, fee disputes/refund requests, and lost ticket replacement.
   - 2-Way Gate & Booth Intercom call simulator with live audio channel and remote barrier raise.
   - Operations Dispatch desk with active support cases queue and human ticket logging.
4. **🛡️ Admin & HITL Center**:
   - Live PostgreSQL `AGENT_LOGS` audit stream & 1-click human-in-the-loop approval buttons for customer refunds and overrides.
5. **📊 Analytics & Revenue BI**:
   - Real-time occupancy percentage bars and revenue tariff summaries.
6. **🔒 System Architecture & Permission Modals**:
   - Direct sidebar links to view the full **12-Layer System Architecture** and **Zero-Trust Permission Matrix**.

### 2. Run Automated Agent & Permission Tests
```bash
npm test
```
This executes the test suite verifying:
- Strict Zero-Trust permission matrix boundaries (e.g., barring Orchestrator from direct tool calls).
- Unauthorized agent invocation blocks (e.g., `CustomerSupportAgent` barred from `ProcessPayment`).
- End-to-end multi-agent DAG task decomposition.

---

## 🎮 Interactive Features on Web Console (`http://localhost:3000`)

1. **🏢 Live Floor Map & Telemetry**:
   - Interactive 2D floor plans (Floor 1, Floor 2, & Floor 3) with real-time slot statuses (Available, Occupied, Reserved, Maintenance).
   - Click **Toggle Sensor** on any slot to simulate real-time IoT state changes over WebSockets.
2. **🛎️ Live Customer Service & Attendant Operations**:
   - Real customer service desk staffed by on-duty facility personnel with response times `< 1 min`.
   - Rapid inquiries (e.g., *"Barrier won't raise at Gate North-1"*, *"Assistance with EV bay at slot F2-03"*, *"Request $5 refund for sensor exit delay"*).
   - 2-Way Audio Gate Intercom with live duration timer and instant barrier lift override.
   - Customer Service Case Tracker with active tickets queue and priority dispatch.
3. **🛡️ Admin & HITL (Human-in-the-Loop) Center**:
   - Real-time PostgreSQL `AGENT_LOGS` audit stream.
   - Pending human sign-off staging queue (e.g., customer refund authorizations).

---

## 📖 Documentation
Detailed technical specifications, ERD, 12-layer architecture diagrams, permission matrices, and workflow sequences can be found in:
👉 [PARKING_SYSTEM_AGENTIC_AI_FACTORY_SPEC.md](file:///c:/Users/yulve/Desktop/parking/documentation/PARKING_SYSTEM_AGENTIC_AI_FACTORY_SPEC.md)
