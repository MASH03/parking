// frontend/public/js/app.js
// Enhanced User-Friendly Controller for Parking System Agentic AI Factory

let currentFloor = 1;
let currentFilter = 'ALL';
let ws = null;
let allSlots = [];
let selectedModalSlot = null;
let selectedHours = 1;

const PAGE_META = {
  'tab-map': { title: 'Live Parking Floor Map', sub: 'Real-time slot telemetry, EV charging status, and 1-click reservations' },
  'tab-overview': { title: 'Overview & Quick Actions', sub: 'Instant shortcuts, garage capacity metrics, and system highlights' },
  'tab-chat': { title: 'AI Assistant & Multi-Agent Factory', sub: 'Conversational Orchestrator with real-time DAG task decomposition' },
  'tab-gate': { title: 'ANPR Gate & Hardware Simulator', sub: 'Computer vision license plate recognition & barrier telemetry' },
  'tab-admin': { title: 'Admin Command & HITL Center', sub: 'Human-in-the-Loop staging queue & immutable agent audit stream' },
  'tab-analytics': { title: 'Analytics & Revenue BI', sub: 'Garage occupancy forecasting, utilization rate & tariff breakdown' }
};


document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initFloorSelector();
  initSlotFilters();
  initChat();
  initGateSimulator();
  initHITL();
  initResetButton();
  initQuickActions();
  initReservationModal();
  initPermsModal();
  initArchModal();
  initQuickDemoRunner();
  initGuidedTour();
  connectWebSocket();
  fetchInitialData();
});

// 1. WebSocket Real-Time Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateWsStatus(true);
    showToast('⚡ Real-time WebSocket stream connected.');
  };

  ws.onmessage = (event) => {
    try {
      const { type, payload } = JSON.parse(event.data);
      handleWebSocketMessage(type, payload);
    } catch (err) {
      console.error('WS Parse Error:', err);
    }
  };

  ws.onclose = () => {
    updateWsStatus(false);
    setTimeout(connectWebSocket, 2000);
  };
}

function updateWsStatus(online) {
  const el = document.getElementById('wsStatus');
  if (!el) return;
  if (online) {
    el.innerHTML = `<span class="status-dot"></span><span class="status-label">Live Stream Active</span>`;
    el.style.color = 'var(--accent-green)';
  } else {
    el.innerHTML = `<span class="status-dot" style="background: var(--accent-red)"></span><span class="status-label">Reconnecting...</span>`;
    el.style.color = 'var(--accent-red)';
  }
}

function handleWebSocketMessage(type, payload) {
  if (type === 'SLOT_UPDATED') {
    const idx = allSlots.findIndex(s => s.slot_id === payload.slot_id);
    if (idx !== -1) {
      allSlots[idx] = payload;
    }
    renderSlots(currentFloor);
    updateMetrics();
    renderAnalytics();
    showToast(`Slot ${payload.slot_number} state changed to ${payload.status}`);
  } else if (type === 'AGENT_LOG_CREATED') {
    prependAuditLog(payload);
  } else if (type === 'STORE_RESET') {
    fetchInitialData();
    showToast('Database store reset to initial seed state.');
  } else if (type === 'HITL_RESOLVED') {
    fetchHITLQueue();
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'alert' ? 'ph-warning' : 'ph-info';
  toast.innerHTML = `<i class="ph-bold ${icon} text-cyan"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 2. Fetch Initial State
async function fetchInitialData() {
  try {
    const [slotsRes, metricsRes, logsRes, hitlRes] = await Promise.all([
      fetch('/api/v1/parking/slots').then(r => r.json()),
      fetch('/api/v1/analytics/metrics').then(r => r.json()),
      fetch('/api/v1/logs/agent').then(r => r.json()),
      fetch('/api/v1/hitl/pending').then(r => r.json())
    ]);

    allSlots = slotsRes.slots || [];
    renderSlots(currentFloor);
    updateMetrics(metricsRes.metrics);
    renderAuditLogs(logsRes);
    renderHITL(hitlRes);
    renderAnalytics();
  } catch (err) {
    console.error('Initial data fetch error:', err);
  }
}

// 3. Sidebar Navigation & Page Titles
function initSidebar() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      item.classList.add('active');
      const target = item.getAttribute('data-tab');
      const targetEl = document.getElementById(target);
      if (targetEl) targetEl.classList.add('active');

      // Update Header Text
      const meta = PAGE_META[target] || PAGE_META['tab-map'];
      document.getElementById('activePageTitle').innerText = meta.title;
      document.getElementById('activePageSubtitle').innerText = meta.sub;
    });
  });
}

function switchToTab(tabId) {
  const btn = document.querySelector(`.sidebar-nav .nav-item[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

// 4. Floor Selector, Slot Filters & Map Rendering
function initFloorSelector() {
  const floorBtns = document.querySelectorAll('.btn-floor');
  floorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      floorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFloor = Number(btn.getAttribute('data-floor'));
      renderSlots(currentFloor);
    });
  });
}

function initSlotFilters() {
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter');
      renderSlots(currentFloor);
    });
  });
}

function renderSlots(floor) {
  const grid = document.getElementById('slotsGrid');
  if (!grid) return;

  // Update Floor Pills (e.g. 5/8 Free)
  const f1Available = allSlots.filter(s => s.floor_number === 1 && s.status === 'AVAILABLE').length;
  const f2Available = allSlots.filter(s => s.floor_number === 2 && s.status === 'AVAILABLE').length;
  const f3Available = allSlots.filter(s => s.floor_number === 3 && s.status === 'AVAILABLE').length;
  const f1El = document.getElementById('f1Pill');
  const f2El = document.getElementById('f2Pill');
  const f3El = document.getElementById('f3Pill');
  if (f1El) f1El.innerText = `${f1Available}/8 Free`;
  if (f2El) f2El.innerText = `${f2Available}/8 Free`;
  if (f3El) f3El.innerText = `${f3Available}/8 Free`;


  let floorSlots = allSlots.filter(s => s.floor_number === floor);

  // Apply filter
  if (currentFilter === 'AVAILABLE') {
    floorSlots = floorSlots.filter(s => s.status === 'AVAILABLE');
  } else if (currentFilter === 'EV') {
    floorSlots = floorSlots.filter(s => s.slot_type === 'EV');
  } else if (currentFilter === 'ACCESSIBLE') {
    floorSlots = floorSlots.filter(s => s.slot_type === 'ACCESSIBLE');
  }

  grid.innerHTML = '';

  if (!floorSlots.length) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-muted);">No slots match the selected filter.</div>`;
    return;
  }

  floorSlots.forEach(slot => {
    const card = document.createElement('div');
    card.className = `slot-card ${slot.status}`;
    card.innerHTML = `
      <div class="slot-header">
        <span class="slot-num">${slot.slot_number}</span>
        <span class="slot-type-badge ${slot.slot_type}">${slot.slot_type}</span>
      </div>
      <div class="slot-status-bar">
        <span class="slot-status-label ${slot.status}">${slot.status}</span>
        <button class="btn-toggle-sensor" data-slot="${slot.slot_id}" title="Simulate Hardware Sensor Trip">
          <i class="ph-bold ph-broadcast"></i> Sensor
        </button>
      </div>
    `;

    const toggleBtn = card.querySelector('.btn-toggle-sensor');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSlotSensor(slot.slot_id);
    });

    card.addEventListener('click', () => {
      if (slot.status === 'AVAILABLE') {
        openReservationModal(slot);
      } else {
        switchToTab('tab-chat');
        const chatInput = document.getElementById('chatInput');
        chatInput.value = `Status check on slot ${slot.slot_number}`;
        document.getElementById('btnSendChat').click();
      }
    });

    grid.appendChild(card);
  });
}

async function toggleSlotSensor(slot_id) {
  try {
    await fetch('/api/v1/parking/slots/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id })
    });
  } catch (err) {
    console.error('Toggle slot error:', err);
  }
}

function updateMetrics(metrics) {
  const total = allSlots.length;
  const available = allSlots.filter(s => s.status === 'AVAILABLE').length;
  const occupied = allSlots.filter(s => s.status === 'OCCUPIED').length;
  const reserved = allSlots.filter(s => s.status === 'RESERVED').length;
  const occRate = total ? Math.round(((occupied + reserved) / total) * 100) : 0;

  const freeEl = document.getElementById('headerFreeSlots');
  if (freeEl) freeEl.innerText = `${available} / ${total}`;

  const totalEl = document.getElementById('statTotalSlots');
  if (totalEl) totalEl.innerText = total;

  const availEl = document.getElementById('statAvailableSlots');
  if (availEl) availEl.innerText = available;

  const occEl = document.getElementById('statOccupancyRate');
  if (occEl) occEl.innerText = `${occRate}%`;

  const resEl = document.getElementById('statReservations');
  if (resEl) resEl.innerText = reserved;


  if (metrics && metrics.total_revenue_usd !== undefined) {
    document.getElementById('statRevenue').innerText = `$${metrics.total_revenue_usd.toFixed(2)}`;
  }
}

// 5. Analytics Tab Rendering
function renderAnalytics() {
  const container = document.getElementById('utilizationBars');
  if (!container) return;

  const total = allSlots.length || 16;
  const available = allSlots.filter(s => s.status === 'AVAILABLE').length;
  const occupied = allSlots.filter(s => s.status === 'OCCUPIED').length;
  const reserved = allSlots.filter(s => s.status === 'RESERVED').length;

  const availPct = Math.round((available / total) * 100);
  const occPct = Math.round((occupied / total) * 100);
  const resPct = Math.round((reserved / total) * 100);

  container.innerHTML = `
    <div class="util-row">
      <div class="util-label"><span>Available Free Slots (${available})</span> <strong>${availPct}%</strong></div>
      <div class="util-track"><div class="util-fill fill-avail" style="width: ${availPct}%"></div></div>
    </div>
    <div class="util-row">
      <div class="util-label"><span>Occupied Vehicles (${occupied})</span> <strong>${occPct}%</strong></div>
      <div class="util-track"><div class="util-fill fill-occ" style="width: ${occPct}%"></div></div>
    </div>
    <div class="util-row">
      <div class="util-label"><span>Active Reservations (${reserved})</span> <strong>${resPct}%</strong></div>
      <div class="util-track"><div class="util-fill fill-res" style="width: ${resPct}%"></div></div>
    </div>
  `;
}

// 6. Fast Action Cards Ribbon
function initQuickActions() {
  document.querySelectorAll('.action-card').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.getAttribute('data-quick');
      if (action === 'find_ev') {
        switchToTab('tab-chat');
        sendOrchestratorPrompt('Find me an EV charging slot on Ground Floor');
      } else if (action === 'reserve_best') {
        switchToTab('tab-chat');
        sendOrchestratorPrompt('Reserve slot F2-04 for plate NY-8821');
      } else if (action === 'sim_ingress') {
        switchToTab('tab-gate');
        document.getElementById('btnSimEntry').click();
      } else if (action === 'sim_egress') {
        switchToTab('tab-gate');
        document.getElementById('btnSimExit').click();
      } else if (action === 'sim_threat') {
        switchToTab('tab-gate');
        document.getElementById('btnSimBlacklist').click();
      }
    });
  });
}

// 7. 1-Click Slot Reservation Modal
function initReservationModal() {
  const modal = document.getElementById('reserveModal');
  const btnClose = document.getElementById('btnCloseReserveModal');
  const btnCancel = document.getElementById('btnCancelModal');
  const btnConfirm = document.getElementById('btnConfirmReserve');
  const durationBtns = document.querySelectorAll('.btn-duration');

  [btnClose, btnCancel].forEach(b => {
    if (b) b.addEventListener('click', () => modal.classList.remove('active'));
  });

  durationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durationBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHours = Number(btn.getAttribute('data-hours'));
      updateModalPrice();
    });
  });

  btnConfirm.addEventListener('click', async () => {
    if (!selectedModalSlot) return;
    const plate = document.getElementById('modalPlateInput').value.trim() || 'ABC-1234';
    modal.classList.remove('active');

    // Send through AI Orchestrator
    switchToTab('tab-chat');
    sendOrchestratorPrompt(`Reserve slot ${selectedModalSlot.slot_number} for plate ${plate} for ${selectedHours} hours`);
  });
}

function openReservationModal(slot) {
  selectedModalSlot = slot;
  document.getElementById('modalSlotNum').innerText = slot.slot_number;
  document.getElementById('modalSlotType').innerText = slot.slot_type;
  document.getElementById('modalSlotFloor').innerText = `Floor ${slot.floor_number}`;
  updateModalPrice();
  document.getElementById('reserveModal').classList.add('active');
}

function updateModalPrice() {
  const baseRate = 5.00;
  let multiplier = 1.0;
  if (selectedModalSlot && selectedModalSlot.slot_type === 'EV') multiplier = 1.25;
  const total = (selectedHours * baseRate * multiplier * 1.08).toFixed(2);
  document.getElementById('modalPriceCalc').innerText = `$${total} USD`;
}

// 8. Modals (Permissions & Architecture)
function initPermsModal() {
  const modal = document.getElementById('permsModal');
  const btnOpen = document.getElementById('btnOpenPerms');
  const btnClose = document.getElementById('btnClosePermsModal');

  if (btnOpen) btnOpen.addEventListener('click', () => modal.classList.add('active'));
  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
}

function initArchModal() {
  const modal = document.getElementById('archModal');
  const btnOpen = document.getElementById('btnOpenArchitecture');
  const btnClose = document.getElementById('btnCloseArchModal');

  if (btnOpen) btnOpen.addEventListener('click', () => modal.classList.add('active'));
  if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
}

// 9. 1-Click Interactive System Demo Walkthrough
function initQuickDemoRunner() {
  const btnDemo = document.getElementById('btnQuickDemo');
  if (!btnDemo) return;

  btnDemo.addEventListener('click', async () => {
    showToast('🚀 Running 1-Click Multi-Agent System Demo...', 'info');
    
    // Step 1: Find Slot
    switchToTab('tab-chat');
    await sendOrchestratorPrompt('Find me an available parking slot near Floor 1');
    
    // Step 2: Book slot
    await new Promise(r => setTimeout(r, 1800));
    await sendOrchestratorPrompt('Reserve slot G-04 for plate AUDI-9988');

    // Step 3: Switch to Gate Simulator
    await new Promise(r => setTimeout(r, 1800));
    switchToTab('tab-gate');
    document.getElementById('simEntryPlate').value = 'AUDI-9988';
    document.getElementById('btnSimEntry').click();

    // Step 4: Switch to Admin
    await new Promise(r => setTimeout(r, 2200));
    switchToTab('tab-admin');
    showToast('🎉 Demo complete! Live Agent DAG, Ingress, & Audit logs updated.', 'info');
  });
}

// 10. 30-Second Guided Tour
function initGuidedTour() {
  const btnTour = document.getElementById('btnStartTour');
  if (!btnTour) return;

  btnTour.addEventListener('click', async () => {
    showToast('🌟 Step 1: Welcome to the 2D Live Parking Floor Map!', 'info');
    switchToTab('tab-map');

    await new Promise(r => setTimeout(r, 2500));
    showToast('🤖 Step 2: Chatting with the AI Orchestrator and inspecting DAG traces...', 'info');
    switchToTab('tab-chat');
    await sendOrchestratorPrompt('Find an EV slot on Ground Floor');

    await new Promise(r => setTimeout(r, 3000));
    showToast('📷 Step 3: ANPR Camera Barrier Gate Ingress & Departure...', 'info');
    switchToTab('tab-gate');

    await new Promise(r => setTimeout(r, 2500));
    showToast('🛡️ Step 4: Human-in-the-Loop admin approvals & compliance logs...', 'info');
    switchToTab('tab-admin');

    await new Promise(r => setTimeout(r, 2500));
    showToast('📊 Step 5: Real-time Analytics & Revenue BI...', 'info');
    switchToTab('tab-analytics');
  });
}

// 11. Agentic AI Chat & Live DAG Inspector
function initChat() {
  const btnSend = document.getElementById('btnSendChat');
  const chatInput = document.getElementById('chatInput');

  // Customer Monologue Chips (Click to Speak)
  document.querySelectorAll('.monologue-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        if (chatInput) chatInput.value = promptText;
        sendOrchestratorPrompt(promptText);
      }
    });
  });

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        if (chatInput) chatInput.value = promptText;
        sendOrchestratorPrompt(promptText);
      }
    });
  });

  if (btnSend) btnSend.addEventListener('click', sendMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendOrchestratorPrompt(text);
  }
}


async function sendOrchestratorPrompt(text) {
  appendChatMessage('user', text);
  const loadingId = appendChatMessage('system', `<i class="ph-bold ph-spinner animate-spin"></i> Orchestrator is planning DAG & delegating to agents...`);

  try {
    const response = await fetch('/api/v1/orchestrator/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const trace = await response.json();

    removeChatMessage(loadingId);
    appendChatMessage('system', trace.final_response);
    renderExecutionTrace(trace);
    return trace;
  } catch (err) {
    removeChatMessage(loadingId);
    appendChatMessage('system', `❌ Error: ${err.message}`);
  }
}

function appendChatMessage(sender, text) {
  const chatMessages = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  msgDiv.id = id;
  msgDiv.className = `message message-${sender}`;

  const icon = sender === 'user' ? 'ph-user' : 'ph-robot';
  msgDiv.innerHTML = `
    <div class="msg-avatar"><i class="ph-bold ${icon}"></i></div>
    <div class="msg-body"><p>${text}</p></div>
  `;

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

function removeChatMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function renderExecutionTrace(trace) {
  const traceBody = document.getElementById('traceBody');
  const traceIdBadge = document.getElementById('traceIdBadge');
  if (!traceBody) return;

  traceIdBadge.innerText = `${trace.trace_id} • ${trace.total_latency_ms}ms`;

  traceBody.innerHTML = `
    <div class="trace-summary-card">
      <div><strong>Detected Intent:</strong> <span style="color:var(--accent-cyan)">${trace.intent}</span></div>
      <div><strong>Confidence:</strong> ${(trace.confidence * 100).toFixed(1)}%</div>
    </div>
    <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
      Execution DAG (${trace.steps.length} Sub-Agent Hops)
    </div>
  `;

  trace.steps.forEach((step, idx) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'dag-step-item';
    stepEl.innerHTML = `
      <div class="dag-step-header">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-weight:700; color:var(--text-muted);">#${idx + 1}</span>
          <span class="agent-badge">${step.agent}</span>
          <span style="font-size:0.8rem; font-weight:600;">${step.action}</span>
        </div>
        <span class="latency-tag">${step.latency_ms}ms</span>
      </div>
      <div class="payload-preview">
        <div>// Request Parameters</div>
        ${JSON.stringify(step.params || {}, null, 2)}
        <div style="margin-top:4px;">// Agent Result Payload</div>
        ${JSON.stringify(step.result?.data || {}, null, 2)}
      </div>
    `;
    traceBody.appendChild(stepEl);
  });
}

// 12. Gate Simulator Handlers with Animated Car Driving Sequences
function initGateSimulator() {
  const btnEntry = document.getElementById('btnSimEntry');
  const btnExit = document.getElementById('btnSimExit');

  const entryPlate = document.getElementById('simEntryPlate');
  const exitPlate = document.getElementById('simExitPlate');
  const entryBarrier = document.getElementById('entryBarrier');
  const exitBarrier = document.getElementById('exitBarrier');

  const entryCar = document.getElementById('entryCar');
  const exitCar = document.getElementById('exitCar');
  const entryPlateBadge = document.getElementById('entryCarPlateBadge');
  const exitPlateBadge = document.getElementById('exitCarPlateBadge');

  if (btnEntry) {
    btnEntry.addEventListener('click', async () => {
      const plate = entryPlate.value.trim() || 'ABC-1234';
      document.getElementById('anprPlateText').innerText = plate;
      if (entryPlateBadge) entryPlateBadge.innerText = plate;

      // Reset and Drive Car to Gate
      if (entryCar) {
        entryCar.className = 'animated-car-wrapper';
        void entryCar.offsetWidth; // Force reflow
        entryCar.classList.add('at-gate');
      }

      // Call AI Orchestrator
      const res = await fetch('/api/v1/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Simulate vehicle ${plate} entering at Gate North-1` })
      }).then(r => r.json());

      if (!res.final_response.includes('❌') && !res.final_response.includes('Denied')) {
        // Barrier Lifts
        setTimeout(() => {
          entryBarrier.classList.add('open');
          // Car Drives Through Gate
          setTimeout(() => {
            if (entryCar) entryCar.classList.add('passed-gate');
            // Lower Barrier after pass
            setTimeout(() => {
              entryBarrier.classList.remove('open');
              // Reset car for next simulation
              setTimeout(() => {
                if (entryCar) entryCar.className = 'animated-car-wrapper';
              }, 1000);
            }, 1500);
          }, 800);
        }, 700);

        showToast(`🚗 Gate Raised: Vehicle ${plate} ingress registered.`, 'info');
      }
      renderExecutionTrace(res);
    });
  }

  if (btnExit) {
    btnExit.addEventListener('click', async () => {
      const plate = exitPlate.value.trim() || 'ABC-1234';
      if (exitPlateBadge) exitPlateBadge.innerText = plate;

      // Drive Exit Car to Barrier
      if (exitCar) {
        exitCar.className = 'animated-car-wrapper';
        void exitCar.offsetWidth;
        exitCar.classList.add('at-gate');
      }

      const res = await fetch('/api/v1/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Simulate vehicle ${plate} exiting at Gate South-1` })
      }).then(r => r.json());

      setTimeout(() => {
        exitBarrier.classList.add('open');
        setTimeout(() => {
          if (exitCar) exitCar.classList.add('passed-gate');
          setTimeout(() => {
            exitBarrier.classList.remove('open');
            setTimeout(() => {
              if (exitCar) exitCar.className = 'animated-car-wrapper';
            }, 1000);
          }, 1500);
        }, 800);
      }, 700);

      showToast(`👋 Exit Cleared: Vehicle ${plate} fee settled.`, 'info');
      renderExecutionTrace(res);
    });
  }
}



// 13. Human-in-the-Loop & Audit Log
function initHITL() {}

function renderHITL(items) {
  const container = document.getElementById('hitlList');
  const badge = document.getElementById('hitlBadge');
  if (!container) return;

  const pending = items.filter(i => i.status === 'PENDING');
  if (badge) badge.innerText = pending.length;

  if (!pending.length) {
    container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No pending human authorizations. All systems clear.</div>`;
    return;
  }

  container.innerHTML = '';
  pending.forEach(item => {
    const el = document.createElement('div');
    el.className = 'hitl-item';
    el.innerHTML = `
      <div class="hitl-title">${item.title}</div>
      <div class="hitl-meta">Requested by: <strong>${item.requested_by}</strong> • Amount: <strong>$${item.amount}</strong></div>
      <div style="font-size:0.85rem;">Reason: "${item.reason}"</div>
      <div class="hitl-actions">
        <button class="btn btn-success btn-sm btn-approve" data-id="${item.hitl_id}">
          <i class="ph-bold ph-check"></i> Approve Refund
        </button>
        <button class="btn btn-danger btn-sm btn-reject" data-id="${item.hitl_id}">
          <i class="ph-bold ph-x"></i> Reject
        </button>
      </div>
    `;

    el.querySelector('.btn-approve').addEventListener('click', () => resolveHITL(item.hitl_id, true));
    el.querySelector('.btn-reject').addEventListener('click', () => resolveHITL(item.hitl_id, false));

    container.appendChild(el);
  });
}

async function resolveHITL(hitl_id, approved) {
  await fetch('/api/v1/hitl/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hitl_id, approved })
  });
  const updated = await fetch('/api/v1/hitl/pending').then(r => r.json());
  renderHITL(updated);
  showToast(approved ? 'HITL Request Approved.' : 'HITL Request Rejected.');
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  logs.slice(0, 20).forEach(l => prependAuditLog(l, false));
}

function prependAuditLog(log, prepend = true) {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  const time = new Date(log.timestamp).toLocaleTimeString();
  tr.innerHTML = `
    <td>${time}</td>
    <td><span class="agent-badge">${log.agent_name}</span></td>
    <td>${log.action}</td>
    <td>${log.execution_latency_ms || 12}ms</td>
    <td style="color:var(--accent-green)">SUCCESS</td>
  `;

  if (prepend && tbody.firstChild) {
    tbody.insertBefore(tr, tbody.firstChild);
  } else {
    tbody.appendChild(tr);
  }
}

// 14. DB Reset Button
function initResetButton() {
  const btn = document.getElementById('btnResetStore');
  if (btn) {
    btn.addEventListener('click', async () => {
      await fetch('/api/v1/reset', { method: 'POST' });
    });
  }
}
