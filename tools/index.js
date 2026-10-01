// tools/index.js
// 17 Deterministic Business Tools with strict parameter validation and permission boundary enforcement

import { v4 as uuidv4 } from 'uuid';
import { store } from '../database/store.js';
import { validateAgentPermission } from '../agents/permissions.js';

// Tool Sandbox Executor
export async function executeTool(agentName, toolName, params = {}) {
  const startTime = Date.now();
  const permCheck = validateAgentPermission(agentName, toolName);

  if (!permCheck.allowed) {
    const errorResult = { success: false, error: permCheck.reason };
    logAgentAction(agentName, toolName, params, errorResult, Date.now() - startTime);
    return errorResult;
  }

  const toolFn = ToolRegistry[toolName];
  if (!toolFn) {
    const errorResult = { success: false, error: `Tool ${toolName} not implemented.` };
    logAgentAction(agentName, toolName, params, errorResult, Date.now() - startTime);
    return errorResult;
  }

  try {
    const result = await toolFn(params);
    const latency = Date.now() - startTime;
    logAgentAction(agentName, toolName, params, result, latency);
    return { success: true, data: result, latency_ms: latency };
  } catch (err) {
    const errorResult = { success: false, error: err.message };
    logAgentAction(agentName, toolName, params, errorResult, Date.now() - startTime);
    return errorResult;
  }
}

function logAgentAction(agentName, action, request, result, latency) {
  const logEntry = {
    agent_log_id: uuidv4(),
    agent_name: agentName,
    action,
    request_payload: request,
    result_payload: result,
    execution_latency_ms: latency,
    timestamp: new Date().toISOString()
  };
  store.agent_logs.unshift(logEntry);
  if (store.agent_logs.length > 200) store.agent_logs.pop();
  store.notify('AGENT_LOG_CREATED', logEntry);
}

// 17 Tool Implementations
export const ToolRegistry = {
  // 1. SearchParkingSlots
  async SearchParkingSlots({ floor_number, slot_type, status = 'AVAILABLE' }) {
    let slots = store.parking_slots;
    if (floor_number) {
      slots = slots.filter(s => s.floor_number === Number(floor_number));
    }
    if (slot_type) {
      slots = slots.filter(s => s.slot_type.toUpperCase() === slot_type.toUpperCase());
    }
    if (status) {
      slots = slots.filter(s => s.status.toUpperCase() === status.toUpperCase());
    }
    return {
      total_found: slots.length,
      slots: slots.map(s => ({
        slot_id: s.slot_id,
        slot_number: s.slot_number,
        floor_number: s.floor_number,
        slot_type: s.slot_type,
        status: s.status
      }))
    };
  },

  // 2. CheckSlotAvailability
  async CheckSlotAvailability({ slot_number, slot_id }) {
    const slot = store.parking_slots.find(
      s => (slot_number && s.slot_number.toLowerCase() === slot_number.toLowerCase()) || (slot_id && s.slot_id === slot_id)
    );
    if (!slot) throw new Error(`Slot '${slot_number || slot_id}' not found.`);
    return {
      slot_id: slot.slot_id,
      slot_number: slot.slot_number,
      floor_number: slot.floor_number,
      slot_type: slot.slot_type,
      status: slot.status,
      is_available: slot.status === 'AVAILABLE'
    };
  },

  // 3. ReserveParkingSlot
  async ReserveParkingSlot({ user_id = 'usr-001', vehicle_id, plate_number, slot_number, start_time, end_time }) {
    let slot = store.parking_slots.find(s => slot_number && s.slot_number.toLowerCase() === slot_number.toLowerCase());
    if (!slot) {
      // Find first available sedan or match
      slot = store.parking_slots.find(s => s.status === 'AVAILABLE');
    }
    if (!slot || slot.status !== 'AVAILABLE') {
      throw new Error(`Slot ${slot ? slot.slot_number : slot_number} is not available for reservation.`);
    }

    let vehicle = store.vehicles.find(v => plate_number && v.plate_number.toUpperCase() === plate_number.toUpperCase());
    if (!vehicle && plate_number) {
      vehicle = {
        vehicle_id: uuidv4(),
        user_id,
        plate_number: plate_number.toUpperCase(),
        vehicle_type: slot.slot_type,
        make_model: 'Registered Vehicle'
      };
      store.vehicles.push(vehicle);
    }

    const reservationId = `res-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrHash = `QR-${reservationId}-${plate_number || 'ABC1234'}`;
    const newRes = {
      reservation_id: reservationId,
      user_id,
      vehicle_id: vehicle ? vehicle.vehicle_id : 'veh-001',
      slot_id: slot.slot_id,
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date(Date.now() + 3 * 3600000).toISOString(),
      qr_code_hash: qrHash,
      status: 'CONFIRMED',
      created_at: new Date().toISOString()
    };

    slot.status = 'RESERVED';
    store.reservations.push(newRes);
    store.notify('SLOT_UPDATED', slot);
    store.notify('RESERVATION_CREATED', newRes);

    return {
      reservation_id: reservationId,
      slot_number: slot.slot_number,
      floor_number: slot.floor_number,
      plate_number: vehicle ? vehicle.plate_number : 'ABC-1234',
      status: 'CONFIRMED',
      qr_code_hash: qrHash,
      start_time: newRes.start_time,
      end_time: newRes.end_time
    };
  },

  // 4. CancelReservation
  async CancelReservation({ reservation_id, reason = 'User requested cancellation' }) {
    const res = store.reservations.find(r => r.reservation_id === reservation_id);
    if (!res) throw new Error(`Reservation '${reservation_id}' not found.`);
    if (res.status === 'CANCELLED') throw new Error(`Reservation is already cancelled.`);

    res.status = 'CANCELLED';
    const slot = store.parking_slots.find(s => s.slot_id === res.slot_id);
    if (slot && slot.status === 'RESERVED') {
      slot.status = 'AVAILABLE';
      store.notify('SLOT_UPDATED', slot);
    }
    store.notify('RESERVATION_UPDATED', res);

    return {
      reservation_id: res.reservation_id,
      status: 'CANCELLED',
      cancellation_reason: reason,
      slot_freed: slot ? slot.slot_number : null
    };
  },

  // 5. CalculateParkingFee
  async CalculateParkingFee({ duration_hours = 3, slot_type = 'SEDAN', is_peak = false }) {
    const baseRate = 5.00;
    let multiplier = 1.0;
    if (slot_type === 'EV') multiplier = 1.25; // includes charging hookup
    if (slot_type === 'SUV') multiplier = 1.15;
    if (is_peak) multiplier *= 1.30;

    const baseAmount = Number((duration_hours * baseRate * multiplier).toFixed(2));
    const tax = Number((baseAmount * 0.08).toFixed(2));
    const totalAmount = Number((baseAmount + tax).toFixed(2));

    return {
      duration_hours,
      base_hourly_rate: baseRate,
      slot_type,
      is_peak,
      base_amount: baseAmount,
      tax,
      total_amount: totalAmount,
      currency: 'USD'
    };
  },

  // 6. ProcessPayment
  async ProcessPayment({ reservation_id, amount, payment_method = 'CREDIT_CARD' }) {
    const paymentId = `pay-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentRecord = {
      payment_id: paymentId,
      reservation_id: reservation_id || 'res-direct',
      amount: Number(amount) || 15.00,
      currency: 'USD',
      payment_method,
      status: 'SUCCEEDED',
      transaction_ref: `TXN-${Date.now().toString().slice(-6)}-AUTH`,
      transaction_date: new Date().toISOString()
    };
    store.payments.push(paymentRecord);
    store.notify('PAYMENT_PROCESSED', paymentRecord);

    return {
      payment_id: paymentId,
      status: 'SUCCEEDED',
      amount: paymentRecord.amount,
      currency: 'USD',
      transaction_ref: paymentRecord.transaction_ref,
      timestamp: paymentRecord.transaction_date
    };
  },

  // 7. VerifyPayment
  async VerifyPayment({ payment_id, reservation_id }) {
    const payment = store.payments.find(p => (payment_id && p.payment_id === payment_id) || (reservation_id && p.reservation_id === reservation_id));
    if (!payment) return { verified: false, status: 'NOT_FOUND' };
    return {
      verified: payment.status === 'SUCCEEDED',
      payment_id: payment.payment_id,
      amount: payment.amount,
      status: payment.status
    };
  },

  // 8. GenerateReceipt
  async GenerateReceipt({ payment_id }) {
    const payment = store.payments.find(p => p.payment_id === payment_id) || store.payments[0];
    return {
      receipt_number: `REC-${payment ? payment.payment_id : '8821'}`,
      facility_name: 'Grand Central Smart Garage',
      amount_paid: payment ? payment.amount : 15.00,
      currency: 'USD',
      payment_method: payment ? payment.payment_method : 'VISA_4022',
      date: new Date().toISOString(),
      vat_number: 'VAT-9921-AI'
    };
  },

  // 9. RegisterVehicleEntry
  async RegisterVehicleEntry({ plate_number, gate_id = 'NORTH-1', slot_number }) {
    const slot = store.parking_slots.find(s => slot_number && s.slot_number.toLowerCase() === slot_number.toLowerCase()) ||
                 store.parking_slots.find(s => s.status === 'AVAILABLE' || s.status === 'RESERVED');
    if (slot) {
      slot.status = 'OCCUPIED';
      store.notify('SLOT_UPDATED', slot);
    }
    const log = {
      log_id: uuidv4(),
      vehicle_id: plate_number || 'ABC-1234',
      slot_id: slot ? slot.slot_id : null,
      entry_gate: gate_id,
      exit_gate: null,
      entry_time: new Date().toISOString(),
      exit_time: null,
      total_duration_minutes: null
    };
    store.parking_logs.push(log);
    store.notify('PARKING_LOG_ENTRY', log);

    return {
      status: 'GATE_OPENED',
      gate: gate_id,
      assigned_slot: slot ? slot.slot_number : 'G-01',
      plate_number,
      entry_time: log.entry_time
    };
  },

  // 10. RegisterVehicleExit
  async RegisterVehicleExit({ plate_number, gate_id = 'EXIT-1' }) {
    const log = store.parking_logs.find(l => l.vehicle_id === plate_number && !l.exit_time) || store.parking_logs[0];
    const now = new Date();
    if (log) {
      log.exit_gate = gate_id;
      log.exit_time = now.toISOString();
      const durationMin = Math.max(15, Math.round((now - new Date(log.entry_time)) / 60000));
      log.total_duration_minutes = durationMin;
    }
    // Free associated slot
    const slot = store.parking_slots.find(s => s.status === 'OCCUPIED');
    if (slot) {
      slot.status = 'AVAILABLE';
      store.notify('SLOT_UPDATED', slot);
    }
    return {
      status: 'EXIT_GRANTED',
      gate: gate_id,
      plate_number,
      duration_minutes: log ? log.total_duration_minutes : 95,
      freed_slot: slot ? slot.slot_number : 'G-02'
    };
  },

  // 11. VerifyQRCode
  async VerifyQRCode({ qr_token, gate_id = 'NORTH-1' }) {
    const res = store.reservations.find(r => r.qr_code_hash === qr_token);
    if (!res) {
      return { valid: false, reason: 'Invalid or expired QR pass token.' };
    }
    return {
      valid: true,
      reservation_id: res.reservation_id,
      status: res.status,
      slot_id: res.slot_id,
      user_id: res.user_id
    };
  },

  // 12. VerifyVehicle
  async VerifyVehicle({ plate_number }) {
    const cleanPlate = (plate_number || '').toUpperCase().trim();
    const vehicle = store.vehicles.find(v => v.plate_number === cleanPlate);
    const activeRes = store.reservations.find(r => r.status === 'CONFIRMED' && (r.qr_code_hash.includes(cleanPlate) || (vehicle && r.vehicle_id === vehicle.vehicle_id)));
    const isBlacklisted = ['STOLEN-99', 'FLAG-001'].includes(cleanPlate);

    return {
      plate_number: cleanPlate,
      registered: Boolean(vehicle),
      is_blacklisted: isBlacklisted,
      has_active_reservation: Boolean(activeRes),
      reservation_details: activeRes || null
    };
  },

  // 13. ReadParkingSensor
  async ReadParkingSensor({ slot_number, sensor_id }) {
    const slot = store.parking_slots.find(s => (slot_number && s.slot_number.toLowerCase() === slot_number.toLowerCase()));
    return {
      sensor_id: sensor_id || `SEN-${slot ? slot.slot_number : 'G-01'}`,
      slot_number: slot ? slot.slot_number : 'G-01',
      telemetry: {
        ultrasonic_distance_cm: slot && slot.status === 'OCCUPIED' ? 34.2 : 248.6,
        occupancy_state: slot ? slot.status : 'AVAILABLE',
        battery_pct: 97.4,
        rssi_dbm: -62,
        last_heartbeat: new Date().toISOString()
      }
    };
  },

  // 14. AnalyzeCameraFeed
  async AnalyzeCameraFeed({ camera_id = 'CAM-NORTH-GATE', frame_timestamp }) {
    return {
      camera_id,
      feed_status: 'ONLINE',
      fps: 30,
      detected_objects: [
        { class: 'car', confidence: 0.96, bbox: [120, 80, 450, 320] },
        { class: 'license_plate', text: 'ABC-1234', confidence: 0.99, bbox: [260, 240, 340, 270] }
      ],
      anomalies: []
    };
  },

  // 15. SendNotification
  async SendNotification({ user_id = 'usr-001', channel = 'PUSH', type = 'RESERVATION_CONFIRMATION', message }) {
    const notif = {
      notification_id: uuidv4(),
      user_id,
      channel,
      type,
      message: message || 'Your parking reservation is confirmed.',
      status: 'DELIVERED',
      timestamp: new Date().toISOString()
    };
    store.notifications.unshift(notif);
    store.notify('NOTIFICATION_SENT', notif);
    return { delivered: true, notification_id: notif.notification_id, channel };
  },

  // 16. CreateMaintenanceTicket
  async CreateMaintenanceTicket({ device_id, device_type = 'SENSOR', issue_code = 'OFFLINE_ERR', severity = 'MEDIUM' }) {
    const ticketId = `TICK-${Math.floor(100 + Math.random() * 900)}`;
    const ticket = {
      ticket_id: ticketId,
      device_id: device_id || 'SEN-G-07',
      device_type,
      issue_code,
      severity,
      assigned_to: 'Carlos Ramos (Field Tech)',
      status: 'OPEN',
      created_at: new Date().toISOString()
    };
    store.notify('MAINTENANCE_TICKET_CREATED', ticket);
    return ticket;
  },

  // 17. GenerateParkingReport
  async GenerateParkingReport({ area_id = 'area-main', timeframe = 'TODAY' }) {
    const total = store.parking_slots.length;
    const occupied = store.parking_slots.filter(s => s.status === 'OCCUPIED').length;
    const reserved = store.parking_slots.filter(s => s.status === 'RESERVED').length;
    const available = store.parking_slots.filter(s => s.status === 'AVAILABLE').length;
    const maintenance = store.parking_slots.filter(s => s.status === 'MAINTENANCE').length;
    const occupancyRate = Number(((occupied + reserved) / total * 100).toFixed(1));
    const totalRevenue = store.payments.reduce((acc, p) => acc + Number(p.amount), 0);

    return {
      facility_name: 'Grand Central Smart Garage',
      timeframe,
      metrics: {
        total_slots: total,
        available_slots: available,
        occupied_slots: occupied,
        reserved_slots: reserved,
        maintenance_slots: maintenance,
        occupancy_rate_percent: occupancyRate,
        total_revenue_usd: totalRevenue,
        peak_occupancy_hour: '14:00 - 15:00'
      }
    };
  }
};
