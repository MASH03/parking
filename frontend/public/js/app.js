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
  'tab-chat': { title: 'Live Customer Service Desk', sub: 'Real on-duty parking attendants, 24/7 gate intercom & operational dispute resolution' },
  'tab-admin': { title: 'Admin Command & HITL Center', sub: 'Human-in-the-Loop staging queue & immutable agent audit stream' },
  'tab-analytics': { title: 'Analytics & Revenue BI', sub: 'Garage occupancy forecasting, utilization rate & tariff breakdown' }
};


document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initFloorSelector();
  initSlotFilters();
  initChat();
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
  } else if (type === 'HITL_RESOLVED' || type === 'HITL_REQUEST_ADDED') {
    fetchHITLQueue();
  } else if (type === 'SUPPORT_MESSAGE_ADDED') {
    appendServiceMessage(payload);
  } else if (type === 'SUPPORT_TICKET_ADDED' || type === 'SUPPORT_TICKET_UPDATED') {
    fetchSupportOverview();
  } else if (type === 'STAFF_UPDATED') {
    fetchSupportOverview();
  } else if (type === 'AUTH_SESSION_CHANGED') {
    fetchAuthSession();
  } else if (type === 'SECURITY_LOG_CREATED') {
    showToast(`🚨 Security Event: ${payload.description}`, 'alert');
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
    fetchSupportOverview();
    fetchAuthSession();
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
        sendCustomerServiceMessage('Hi Carlos, could you check available EV charging bays on Floor 1 and 2?');
      } else if (action === 'reserve_best') {
        switchToTab('tab-chat');
        sendCustomerServiceMessage('Hello, please help me hold slot F2-04 for plate NY-8821');
      } else if (action === 'check_rates') {
        switchToTab('tab-chat');
        sendCustomerServiceMessage('What are the hourly parking rates, EV fees, and grace period?');
      } else if (action === 'view_admin') {
        switchToTab('tab-admin');
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

    // Confirm reservation and notify Customer Service
    switchToTab('tab-chat');
    sendCustomerServiceMessage(`Please confirm reservation of slot ${selectedModalSlot.slot_number} for plate ${plate} for ${selectedHours} hours`);
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
    showToast('🚀 Running 1-Click Customer Service & System Demo...', 'info');
    
    // Step 1: Connect to Customer Service
    switchToTab('tab-chat');
    await sendCustomerServiceMessage('Hi Carlos, I need assistance reserving an EV slot near Floor 1');
    
    // Step 2: Book slot
    await new Promise(r => setTimeout(r, 1800));
    await sendCustomerServiceMessage('Please reserve slot G-04 for plate AUDI-9988');

    // Step 3: Switch to Admin
    await new Promise(r => setTimeout(r, 2000));
    switchToTab('tab-admin');
    showToast('🎉 Demo complete! Live Customer Service & Attendant logs updated.', 'info');
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
    showToast('🛎️ Step 2: Live Customer Service Desk & Attendant Support...', 'info');
    switchToTab('tab-chat');
    await sendCustomerServiceMessage('Hi Carlos, can you verify if EV charging slot F2-03 is available?');

    await new Promise(r => setTimeout(r, 3000));
    showToast('🛡️ Step 3: Human-in-the-Loop admin approvals & compliance logs...', 'info');
    switchToTab('tab-admin');

    await new Promise(r => setTimeout(r, 2500));
    showToast('📊 Step 4: Real-time Analytics & Revenue BI...', 'info');
    switchToTab('tab-analytics');
  });
}

// 11. Real Customer Service & Live Attendant Desk
let currentSupportOverview = { staff: [], tickets: [], messages: [] };
let currentAuthSession = null;
let availableStaffProfiles = [];
let availableDriverProfiles = [];
let selectedStaffLoginId = 'ATT-101';
let selectedDriverLoginId = 'usr-001';
let selectedTicketPriority = 'NORMAL';
let intercomTimer = null;
let intercomSeconds = 0;

function initCustomerServiceDesk() {
  const btnSend = document.getElementById('btnSendChat');
  const chatInput = document.getElementById('chatInput');

  // Service Inquiry Chips (Click to Speak / Ask Attendant)
  document.querySelectorAll('.service-chip, .monologue-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        if (chatInput) chatInput.value = promptText;
        sendCustomerServiceMessage(promptText);
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
    sendCustomerServiceMessage(text);
  }

  initAuthLoginModal();
  initCustomerServiceModals();
  initDeskActionButtons();
  initMobileSubtabs();
}

// Alias for legacy calls
const initChat = initCustomerServiceDesk;
const sendOrchestratorPrompt = sendCustomerServiceMessage;

// Fetch Live Support Overview
async function fetchSupportOverview() {
  try {
    const res = await fetch('/api/v1/support/overview');
    const data = await res.json();
    currentSupportOverview = data;

    renderStaffRoster(data.staff || []);
    renderSupportTickets(data.tickets || []);
    renderSupportMessages(data.messages || []);
  } catch (err) {
    console.error('Fetch support overview error:', err);
  }
}

// Fetch Current Authentication Session
async function fetchAuthSession() {
  try {
    const res = await fetch('/api/v1/auth/session');
    const data = await res.json();
    currentAuthSession = data.session || { is_authenticated: false, account_type: 'CUSTOMER', name: 'Guest Driver', vehicle_plate: 'NY-8821' };
    availableStaffProfiles = data.staff_roster || [];
    availableDriverProfiles = data.registered_drivers || [];

    renderAuthUI();
    renderLoginModalProfiles();
  } catch (err) {
    console.error('Fetch auth session error:', err);
  }
}

// Update UI to reflect current auth session (Customer vs Staff Operator mode)
function renderAuthUI() {
  const nameEl = document.getElementById('sessionAuthName');
  const subEl = document.getElementById('sessionAuthSub');
  const iconEl = document.getElementById('sessionAuthIcon');
  const pillEl = document.getElementById('sessionAuthPill');
  const loginBtnLabel = document.getElementById('loginBtnLabel');
  const opBanner = document.getElementById('operatorModeBanner');
  const opName = document.getElementById('operatorStaffName');
  const dutyToggle = document.getElementById('btnDutyToggle');
  const chatInput = document.getElementById('chatInput');

  if (!currentAuthSession) return;

  const isStaff = currentAuthSession.account_type === 'STAFF';

  if (isStaff) {
    if (pillEl) pillEl.classList.add('staff-active');
    if (iconEl) iconEl.innerText = currentAuthSession.avatar || '👨‍💼';
    if (nameEl) nameEl.innerText = currentAuthSession.name;
    if (subEl) subEl.innerText = `${currentAuthSession.role} (${currentAuthSession.staff_id || 'Staff'})`;
    if (loginBtnLabel) loginBtnLabel.innerText = 'Switch Staff';
    if (opBanner) opBanner.style.display = 'block';
    if (opName) opName.innerText = `${currentAuthSession.name} (${currentAuthSession.staff_id || 'ATT-101'})`;
    
    if (dutyToggle) {
      const isBreak = currentAuthSession.status === 'ON_BREAK';
      dutyToggle.innerText = isBreak ? '🟡 On Break' : '🟢 On Duty';
      if (isBreak) dutyToggle.classList.add('break');
      else dutyToggle.classList.remove('break');
    }

    if (chatInput) {
      chatInput.placeholder = `Reply as Operator ${currentAuthSession.name.split(' ')[0]} (${currentAuthSession.role})...`;
    }
  } else {
    if (pillEl) pillEl.classList.remove('staff-active');
    if (iconEl) iconEl.innerText = currentAuthSession.avatar || '🚗';
    if (nameEl) nameEl.innerText = currentAuthSession.name || 'Guest Driver';
    if (subEl) subEl.innerText = `Plate: ${currentAuthSession.vehicle_plate || 'NY-8821'}`;
    if (loginBtnLabel) loginBtnLabel.innerText = currentAuthSession.is_authenticated ? 'Switch Driver' : 'Log In / Staff';
    if (opBanner) opBanner.style.display = 'none';

    if (chatInput) {
      chatInput.placeholder = `Message Carlos as ${currentAuthSession.name} (${currentAuthSession.vehicle_plate})...`;
    }
  }

  // Re-render tickets to reveal Resolve buttons if in staff mode
  if (currentSupportOverview.tickets) {
    renderSupportTickets(currentSupportOverview.tickets);
  }
}

// Send Message to Real Customer Service Attendant
async function sendCustomerServiceMessage(text) {
  const isStaff = currentAuthSession && currentAuthSession.account_type === 'STAFF';

  if (isStaff) {
    // Message sent by Attendant Operator
    const staffMsg = {
      id: `csm-${Date.now()}-staff-direct`,
      sender: 'staff',
      staff_name: currentAuthSession.name,
      staff_role: currentAuthSession.role,
      location: currentAuthSession.location || 'Ground Booth B-1',
      avatar: currentAuthSession.avatar || '👨‍💼',
      badge: 'Operator Reply',
      text: text,
      timestamp: new Date().toISOString()
    };
    appendServiceMessage(staffMsg);

    try {
      await fetch('/api/v1/support/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          user_name: currentAuthSession.name,
          vehicle_plate: 'STAFF-DESK'
        })
      });
      fetchSupportOverview();
    } catch (err) {
      console.error('Operator message error:', err);
    }
    return;
  }

  // Message sent by Customer / Driver
  const userName = currentAuthSession ? currentAuthSession.name : 'Driver / Guest';
  const userPlate = currentAuthSession ? currentAuthSession.vehicle_plate : 'NY-8821';

  appendServiceMessage({
    id: `csm-${Date.now()}-user`,
    sender: 'user',
    user_name: userName,
    text: text,
    timestamp: new Date().toISOString()
  });

  // Typing indicator
  const typingId = appendTypingIndicator('Carlos Ramos (Attendant) is responding...');

  try {
    const res = await fetch('/api/v1/support/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, user_name: userName, vehicle_plate: userPlate })
    });
    const result = await res.json();

    removeServiceMessage(typingId);

    if (result.staff_message) {
      appendServiceMessage(result.staff_message);
    }
    if (result.tickets) {
      renderSupportTickets(result.tickets);
    }
    if (result.hitl_requests) {
      renderHITL(result.hitl_requests);
    }
  } catch (err) {
    removeServiceMessage(typingId);
    appendServiceMessage({
      sender: 'staff',
      staff_name: 'Carlos Ramos',
      staff_role: 'Head Parking Attendant',
      avatar: '👨‍💼',
      badge: 'System Notice',
      text: `❌ Connection error reaching service booth: ${err.message}. Please call our direct hotline at +1 (800) 555-PARK (Ext 101).`,
      timestamp: new Date().toISOString()
    });
  }
}

// Render Message Bubble
function appendServiceMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const id = msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const existing = document.getElementById(id);
  if (existing) return; // avoid duplicate rendering

  const msgDiv = document.createElement('div');
  msgDiv.id = id;

  const isUser = msg.sender === 'user';
  msgDiv.className = `message ${isUser ? 'message-user' : 'message-staff'}`;

  const timeFormatted = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    msgDiv.innerHTML = `
      <div class="msg-avatar"><i class="ph-bold ph-user"></i></div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author">${msg.user_name || 'Driver / Guest'}</span>
          <span class="msg-time">${timeFormatted}</span>
        </div>
        <p>${msg.text}</p>
      </div>
    `;
  } else {
    let actionsHtml = '';
    if (msg.actions && msg.actions.length > 0) {
      actionsHtml = msg.actions.map(act => `<span class="action-tag-pill"><i class="ph-bold ph-check-circle"></i> ${act}</span>`).join(' ');
    }

    msgDiv.innerHTML = `
      <div class="msg-avatar staff-avatar">${msg.avatar || '👨‍💼'}</div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author">${msg.staff_name || 'Carlos Ramos'}</span>
          <span class="msg-badge">${msg.staff_role || msg.badge || 'Staff On Duty'}</span>
          <span class="msg-time">${timeFormatted}</span>
        </div>
        <p>${msg.text}</p>
        ${actionsHtml}
        <div class="msg-quick-actions">
          <span class="quick-chip" data-quick-text="Is there an available EV charging slot on Floor 1 or 2?">⚡ Inquire EV Slot</span>
          <span class="quick-chip" data-quick-text="I need assistance lifting barrier arm at Gate North-1">🚨 Gate Assistance</span>
          <span class="quick-chip" data-quick-text="Can you resend my reservation QR barcode pass?">🎫 Resend Pass</span>
          <span class="quick-chip" data-quick-text="What are your hourly rates and grace period policies?">ℹ️ Tariff Info</span>
        </div>
      </div>
    `;

    // Hook quick chip clicks inside message
    msgDiv.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-quick-text');
        if (text) {
          const chatInput = document.getElementById('chatInput');
          if (chatInput) chatInput.value = text;
          sendCustomerServiceMessage(text);
        }
      });
    });
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  return id;
}

// Alias for old appendChatMessage
const appendChatMessage = (sender, text) => {
  return appendServiceMessage({
    sender: sender === 'user' ? 'user' : 'staff',
    staff_name: 'Carlos Ramos',
    staff_role: 'Head Parking Attendant',
    avatar: '👨‍💼',
    text: text,
    timestamp: new Date().toISOString()
  });
};

function appendTypingIndicator(statusText) {
  const container = document.getElementById('chatMessages');
  const id = `typing-${Date.now()}`;
  const el = document.createElement('div');
  el.id = id;
  el.className = 'message message-staff';
  el.innerHTML = `
    <div class="msg-avatar staff-avatar">👨‍💼</div>
    <div class="msg-body" style="display:flex;align-items:center;gap:0.5rem;color:var(--text-secondary);font-size:0.85rem;">
      <i class="ph-bold ph-spinner animate-spin text-cyan"></i>
      <span>${statusText}</span>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeServiceMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
const removeChatMessage = removeServiceMessage;

// Render All Support Messages
function renderSupportMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = '';
  messages.forEach(m => appendServiceMessage(m));
}

// Render Staff Roster
function renderStaffRoster(staffList) {
  const listEl = document.getElementById('staffRosterList');
  const badgeEl = document.getElementById('staffOnDutyCount');
  if (!listEl) return;

  if (badgeEl) badgeEl.innerText = `${staffList.length} Active`;
  listEl.innerHTML = '';

  staffList.forEach(s => {
    const isOnline = s.status === 'ON_DUTY' || s.status === 'ONLINE';
    const statusText = s.status === 'ON_DUTY' ? '🟢 On Duty' : s.status === 'ONLINE' ? '🟢 Online' : '🟡 On Call';
    const item = document.createElement('div');
    item.className = 'roster-item';
    item.innerHTML = `
      <div class="roster-avatar">${s.avatar || '👨‍💼'}</div>
      <div class="roster-info">
        <span class="roster-name">${s.name}</span>
        <span class="roster-role">${s.role} • ${s.phone}</span>
        <span class="roster-status-pill ${isOnline ? 'online' : 'on-call'}">${statusText}</span>
      </div>
    `;
    listEl.appendChild(item);
  });
}

// Render Active Support Tickets
function renderSupportTickets(tickets) {
  const listEl = document.getElementById('supportTicketList');
  const badgeEl = document.getElementById('traceIdBadge');
  const mobCount = document.getElementById('mobileStepCount');
  if (!listEl) return;

  const openTickets = tickets.filter(t => t.status !== 'RESOLVED');
  if (badgeEl) badgeEl.innerText = `${openTickets.length} Active Cases`;
  if (mobCount) mobCount.innerText = openTickets.length;

  if (!openTickets.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.8rem;">All customer cases resolved!</div>`;
    return;
  }

  const isStaff = currentAuthSession && currentAuthSession.account_type === 'STAFF';

  listEl.innerHTML = '';
  openTickets.forEach(t => {
    const priorityClass = t.priority === 'HIGH' ? 'priority-high' : t.priority === 'MEDIUM' ? 'priority-medium' : 'priority-normal';
    const timeAgo = Math.max(1, Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000));
    
    const card = document.createElement('div');
    card.className = 'ticket-item';
    card.innerHTML = `
      <div class="ticket-head">
        <span class="ticket-id">${t.ticket_id}</span>
        <span class="ticket-priority-pill ${priorityClass}">${t.priority}</span>
      </div>
      <div class="ticket-sub">${t.subject}</div>
      <div class="ticket-meta">
        <span><i class="ph-bold ph-map-pin"></i> ${t.location}</span>
        <span><i class="ph-bold ph-user"></i> ${t.assigned_to.split(' ')[0]} • ${timeAgo}m ago</span>
      </div>
      ${isStaff ? `
        <div style="margin-top:0.45rem; display:flex; justify-content:flex-end;">
          <button class="btn-resolve-ticket" data-id="${t.ticket_id}" title="Mark this ticket as resolved">
            <i class="ph-bold ph-check-circle"></i> Resolve Case
          </button>
        </div>
      ` : ''}
    `;

    if (isStaff) {
      const btnResolve = card.querySelector('.btn-resolve-ticket');
      if (btnResolve) {
        btnResolve.addEventListener('click', (e) => {
          e.stopPropagation();
          resolveTicket(t.ticket_id);
        });
      }
    }

    listEl.appendChild(card);
  });
}

// Render Driver & Staff selectable cards in Login Modal
function renderLoginModalProfiles() {
  const driverGrid = document.getElementById('quickDriverGrid');
  const staffGrid = document.getElementById('quickStaffGrid');

  if (driverGrid && availableDriverProfiles.length > 0) {
    driverGrid.innerHTML = '';
    availableDriverProfiles.forEach(d => {
      const card = document.createElement('div');
      card.className = `quick-auth-card ${selectedDriverLoginId === d.user_id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="quick-auth-avatar">🏎️</div>
        <div class="quick-auth-info">
          <span class="quick-auth-name">${d.name}</span>
          <span class="quick-auth-sub">${d.plate} • ${d.model.split(' ')[0]}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        driverGrid.querySelectorAll('.quick-auth-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedDriverLoginId = d.user_id;
        const nameInput = document.getElementById('loginDriverName');
        const plateInput = document.getElementById('loginDriverPlate');
        if (nameInput) nameInput.value = d.name;
        if (plateInput) plateInput.value = d.plate;
      });
      driverGrid.appendChild(card);
    });
  }

  if (staffGrid && availableStaffProfiles.length > 0) {
    staffGrid.innerHTML = '';
    availableStaffProfiles.forEach(s => {
      const card = document.createElement('div');
      card.className = `quick-auth-card staff-card ${selectedStaffLoginId === s.staff_id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="quick-auth-avatar">${s.avatar || '👨‍💼'}</div>
        <div class="quick-auth-info">
          <span class="quick-auth-name">${s.name}</span>
          <span class="quick-auth-sub">${s.role} (${s.staff_id})</span>
        </div>
      `;
      card.addEventListener('click', () => {
        staffGrid.querySelectorAll('.quick-auth-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedStaffLoginId = s.staff_id;
      });
      staffGrid.appendChild(card);
    });
  }
}

// Authentication & Role Switcher Modal Logic
function initAuthLoginModal() {
  const modal = document.getElementById('serviceLoginModal');
  const btnOpen = document.getElementById('btnOpenLoginModal');
  const pillOpen = document.getElementById('sessionAuthPill');
  const btnClose = document.getElementById('btnCloseLoginModal');
  const btnCancelDriver = document.getElementById('btnCancelLoginModal');
  const btnCancelStaff = document.getElementById('btnCancelStaffLogin');
  const btnLogoutStaff = document.getElementById('btnLogoutStaff');
  const btnDutyToggle = document.getElementById('btnDutyToggle');

  const tabDriver = document.getElementById('tabDriverLogin');
  const tabStaff = document.getElementById('tabStaffLogin');
  const panelDriver = document.getElementById('panelDriverLogin');
  const panelStaff = document.getElementById('panelStaffLogin');

  const btnSubmitDriver = document.getElementById('btnSubmitDriverLogin');
  const btnSubmitStaff = document.getElementById('btnSubmitStaffLogin');

  function openModal() {
    if (modal) {
      modal.classList.add('active');
      renderLoginModalProfiles();
    }
  }

  function closeModal() {
    if (modal) modal.classList.remove('active');
  }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (pillOpen) pillOpen.addEventListener('click', openModal);
  [btnClose, btnCancelDriver, btnCancelStaff].forEach(b => {
    if (b) b.addEventListener('click', closeModal);
  });

  // Switch between Driver and Staff tabs
  if (tabDriver && tabStaff && panelDriver && panelStaff) {
    tabDriver.addEventListener('click', () => {
      tabDriver.classList.add('active');
      tabDriver.style.background = 'var(--accent-primary)';
      tabDriver.style.color = '#fff';
      tabStaff.classList.remove('active');
      tabStaff.style.background = 'transparent';
      tabStaff.style.color = 'var(--text-secondary)';
      panelDriver.style.display = 'block';
      panelStaff.style.display = 'none';
    });

    tabStaff.addEventListener('click', () => {
      tabStaff.classList.add('active');
      tabStaff.style.background = 'var(--accent-green)';
      tabStaff.style.color = '#fff';
      tabDriver.classList.remove('active');
      tabDriver.style.background = 'transparent';
      tabDriver.style.color = 'var(--text-secondary)';
      panelStaff.style.display = 'block';
      panelDriver.style.display = 'none';
    });
  }

  // Submit Driver Login
  if (btnSubmitDriver) {
    btnSubmitDriver.addEventListener('click', async () => {
      const name = document.getElementById('loginDriverName').value.trim() || 'Alex Johnson';
      const plate = document.getElementById('loginDriverPlate').value.trim() || 'ABC-1234';

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_type: 'CUSTOMER',
            user_id: selectedDriverLoginId,
            name,
            plate_number: plate
          })
        });
        const data = await res.json();
        closeModal();
        showToast(`Logged in as Driver: ${data.session.name} (${data.session.vehicle_plate})`);
        fetchAuthSession();
      } catch (err) {
        showToast(`Login error: ${err.message}`, 'alert');
      }
    });
  }

  // Submit Staff Login
  if (btnSubmitStaff) {
    btnSubmitStaff.addEventListener('click', async () => {
      const pin = document.getElementById('loginStaffPin').value.trim() || '1234';

      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_type: 'STAFF',
            staff_id: selectedStaffLoginId,
            pin
          })
        });
        const data = await res.json();
        if (data.error) {
          showToast(data.error, 'alert');
          return;
        }
        closeModal();
        showToast(`Staff Operator Session Unlocked: ${data.session.name} (${data.session.staff_id})`);
        fetchAuthSession();
        fetchSupportOverview();
      } catch (err) {
        showToast(`Staff authentication failed: ${err.message}`, 'alert');
      }
    });
  }

  // Logout Staff Mode
  if (btnLogoutStaff) {
    btnLogoutStaff.addEventListener('click', async () => {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      showToast('Logged out of Staff Mode. Returned to Driver Session.');
      fetchAuthSession();
      fetchSupportOverview();
    });
  }

  // Duty Status Toggle
  if (btnDutyToggle) {
    btnDutyToggle.addEventListener('click', async () => {
      if (!currentAuthSession || currentAuthSession.account_type !== 'STAFF') return;
      const res = await fetch('/api/v1/support/toggle-duty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: currentAuthSession.staff_id })
      });
      const data = await res.json();
      showToast(`Duty Status toggled to: ${data.staff.status}`);
      fetchAuthSession();
      fetchSupportOverview();
    });
  }
}

// Resolve Ticket Handler (Staff Operator)
async function resolveTicket(ticket_id) {
  try {
    const res = await fetch('/api/v1/support/resolve-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id,
        resolved_by: currentAuthSession ? currentAuthSession.name : 'Carlos Ramos'
      })
    });
    const data = await res.json();
    showToast(`Case #${ticket_id} marked as RESOLVED!`);
    fetchSupportOverview();
  } catch (err) {
    showToast(`Error resolving ticket: ${err.message}`, 'alert');
  }
}

// Customer Service Modals (Ticket & Intercom)
function initCustomerServiceModals() {
  // Ticket Modal
  const ticketModal = document.getElementById('ticketModal');
  const btnOpenTicket = document.getElementById('btnOpenTicketModal');
  const btnCloseTicket = document.getElementById('btnCloseTicketModal');
  const btnCancelTicket = document.getElementById('btnCancelTicketModal');
  const btnSubmitTicket = document.getElementById('btnSubmitTicket');

  if (btnOpenTicket) btnOpenTicket.addEventListener('click', () => ticketModal.classList.add('active'));
  [btnCloseTicket, btnCancelTicket].forEach(b => {
    if (b) b.addEventListener('click', () => ticketModal.classList.remove('active'));
  });

  document.querySelectorAll('.btn-priority-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-priority-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTicketPriority = btn.getAttribute('data-priority');
    });
  });

  if (btnSubmitTicket) {
    btnSubmitTicket.addEventListener('click', async () => {
      const subject = document.getElementById('ticketSubject').value.trim();
      const category = document.getElementById('ticketCategory').value;
      const location = document.getElementById('ticketLocation').value.trim();
      const vehicle_plate = document.getElementById('ticketPlate').value.trim();
      const description = document.getElementById('ticketDesc').value.trim();

      if (!subject) {
        showToast('Please provide a subject for the ticket', 'alert');
        return;
      }

      try {
        const res = await fetch('/api/v1/support/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            category,
            location,
            vehicle_plate,
            priority: selectedTicketPriority,
            description
          })
        });
        const data = await res.json();
        ticketModal.classList.remove('active');
        showToast(`Case #${data.ticket.ticket_id} created and dispatched!`);
        fetchSupportOverview();
      } catch (err) {
        showToast(`Error creating ticket: ${err.message}`, 'alert');
      }
    });
  }

  // Intercom Modal
  const intercomModal = document.getElementById('intercomModal');
  const btnOpenIntercom = document.getElementById('btnOpenIntercom');
  const btnTriggerDirect = document.getElementById('btnTriggerDirectIntercom');
  const btnCloseIntercom = document.getElementById('btnCloseIntercomModal');
  const btnEndIntercom = document.getElementById('btnEndIntercomCall');
  const btnIntercomRaiseGate = document.getElementById('btnIntercomRaiseGate');

  function openIntercomCall() {
    if (!intercomModal) return;
    intercomModal.classList.add('active');
    intercomSeconds = 0;
    const durEl = document.getElementById('intercomDuration');
    if (durEl) durEl.innerText = '00:00';

    if (intercomTimer) clearInterval(intercomTimer);
    intercomTimer = setInterval(() => {
      intercomSeconds++;
      const m = String(Math.floor(intercomSeconds / 60)).padStart(2, '0');
      const s = String(intercomSeconds % 60).padStart(2, '0');
      if (durEl) durEl.innerText = `${m}:${s}`;
    }, 1000);

    fetch('/api/v1/support/intercom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station: 'Gate North-1 Intercom Kiosk' })
    });
  }

  function closeIntercomCall() {
    if (intercomTimer) clearInterval(intercomTimer);
    intercomTimer = null;
    if (intercomModal) intercomModal.classList.remove('active');
    showToast('Intercom call ended.');
  }

  if (btnOpenIntercom) btnOpenIntercom.addEventListener('click', openIntercomCall);
  if (btnTriggerDirect) btnTriggerDirect.addEventListener('click', openIntercomCall);
  if (btnCloseIntercom) btnCloseIntercom.addEventListener('click', closeIntercomCall);
  if (btnEndIntercom) btnEndIntercom.addEventListener('click', closeIntercomCall);

  if (btnIntercomRaiseGate) {
    btnIntercomRaiseGate.addEventListener('click', async () => {
      await fetch('/api/v1/support/gate-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gate_id: 'GATE-NORTH-1', reason: 'Intercom Attendant Verification' })
      });
      showToast('🚨 Barrier Gate North-1 raised remotely by Attendant Carlos Ramos!');
      sendCustomerServiceMessage('Carlos has confirmed remote barrier lift at Gate North-1 via 2-way Intercom.');
    });
  }
}

// Rapid Operational Desk Action Buttons
function initDeskActionButtons() {
  const btnGate = document.getElementById('btnActionGateLift');
  const btnTech = document.getElementById('btnActionDispatchTech');
  const btnPass = document.getElementById('btnActionCreatePass');
  const btnRefresh = document.getElementById('btnRefreshTickets');

  if (btnGate) {
    btnGate.addEventListener('click', async () => {
      await fetch('/api/v1/support/gate-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gate_id: 'GATE-NORTH-1', reason: 'Manual Desk Override' })
      });
      showToast('🚨 Attendant Carlos Ramos remotely raised Barrier Gate North-1!');
      sendCustomerServiceMessage('Attendant remote override triggered for Gate North-1 barrier arm.');
    });
  }

  if (btnTech) {
    btnTech.addEventListener('click', async () => {
      await fetch('/api/v1/support/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_name: 'Marcus Vance', target_floor: 'Floor 2 EV Bay' })
      });
      showToast('👷‍♂️ Field Technician Marcus Vance dispatched to Floor 2 EV Bay!');
      fetchSupportOverview();
    });
  }

  if (btnPass) {
    btnPass.addEventListener('click', () => {
      sendCustomerServiceMessage('Please generate a digital emergency exit pass for plate NY-8821');
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      fetchSupportOverview();
      showToast('Active customer support cases refreshed.');
    });
  }
}

// Mobile Chat vs Desk Tab Switcher
function initMobileSubtabs() {
  const btnChat = document.getElementById('btnShowChatPanel');
  const btnDesk = document.getElementById('btnShowTracePanel');
  const chatPanel = document.getElementById('chatPanelEl');
  const deskPanel = document.getElementById('tracePanelEl');

  if (btnChat && btnDesk) {
    btnChat.addEventListener('click', () => {
      btnChat.classList.add('active');
      btnDesk.classList.remove('active');
      if (chatPanel) chatPanel.style.display = 'flex';
      if (deskPanel) deskPanel.style.display = 'none';
    });

    btnDesk.addEventListener('click', () => {
      btnDesk.classList.add('active');
      btnChat.classList.remove('active');
      if (chatPanel) chatPanel.style.display = 'none';
      if (deskPanel) deskPanel.style.display = 'flex';
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
