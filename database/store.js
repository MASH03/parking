// database/store.js
// In-Memory Transactional Store with Seed Data matching the 11-table schema

import { v4 as uuidv4 } from 'uuid';

class ParkingStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [
      { user_id: 'usr-001', name: 'Alex Johnson', email: 'alex.j@example.com', phone: '+1-555-0192', role: 'DRIVER' },
      { user_id: 'usr-002', name: 'Maria Chen', email: 'maria.c@example.com', phone: '+1-555-0183', role: 'DRIVER' },
      { user_id: 'usr-admin', name: 'Sarah Connor (Admin)', email: 'admin@parking.ai', phone: '+1-555-0100', role: 'ADMIN' },
      { user_id: 'usr-attendant', name: 'Carlos Ramos (Attendant)', email: 'carlos@parking.ai', phone: '+1-555-0101', role: 'ATTENDANT' }
    ];

    this.vehicles = [
      { vehicle_id: 'veh-001', user_id: 'usr-001', plate_number: 'ABC-1234', vehicle_type: 'SEDAN', make_model: 'Audi A4' },
      { vehicle_id: 'veh-002', user_id: 'usr-002', plate_number: 'EV-8890', vehicle_type: 'EV', make_model: 'Tesla Model 3' },
      { vehicle_id: 'veh-003', user_id: 'usr-001', plate_number: 'SUV-9900', vehicle_type: 'SUV', make_model: 'BMW X5' }
    ];

    this.parking_areas = [
      { area_id: 'area-main', name: 'Grand Central Smart Garage', location: '100 Metro Plaza, Downtown', total_capacity: 24, base_hourly_rate: 5.00 }
    ];

    // 24 slots across Floor 1, Floor 2 & Floor 3
    this.parking_slots = [
      // Floor 1 (Ground)
      { slot_id: 'slot-g01', area_id: 'area-main', slot_number: 'G-01', slot_type: 'SEDAN', floor_number: 1, status: 'AVAILABLE' },
      { slot_id: 'slot-g02', area_id: 'area-main', slot_number: 'G-02', slot_type: 'SEDAN', floor_number: 1, status: 'OCCUPIED' },
      { slot_id: 'slot-g03', area_id: 'area-main', slot_number: 'G-03', slot_type: 'EV', floor_number: 1, status: 'AVAILABLE' },
      { slot_id: 'slot-g04', area_id: 'area-main', slot_number: 'G-04', slot_type: 'EV', floor_number: 1, status: 'AVAILABLE' },
      { slot_id: 'slot-g05', area_id: 'area-main', slot_number: 'G-05', slot_type: 'ACCESSIBLE', floor_number: 1, status: 'AVAILABLE' },
      { slot_id: 'slot-g06', area_id: 'area-main', slot_number: 'G-06', slot_type: 'SUV', floor_number: 1, status: 'OCCUPIED' },
      { slot_id: 'slot-g07', area_id: 'area-main', slot_number: 'G-07', slot_type: 'SEDAN', floor_number: 1, status: 'MAINTENANCE' },
      { slot_id: 'slot-g08', area_id: 'area-main', slot_number: 'G-08', slot_type: 'MOTORCYCLE', floor_number: 1, status: 'AVAILABLE' },
      // Floor 2 (Upper Deck)
      { slot_id: 'slot-f201', area_id: 'area-main', slot_number: 'F2-01', slot_type: 'SEDAN', floor_number: 2, status: 'AVAILABLE' },
      { slot_id: 'slot-f202', area_id: 'area-main', slot_number: 'F2-02', slot_type: 'SEDAN', floor_number: 2, status: 'AVAILABLE' },
      { slot_id: 'slot-f203', area_id: 'area-main', slot_number: 'F2-03', slot_type: 'EV', floor_number: 2, status: 'OCCUPIED' },
      { slot_id: 'slot-f204', area_id: 'area-main', slot_number: 'F2-04', slot_type: 'SEDAN', floor_number: 2, status: 'RESERVED' },
      { slot_id: 'slot-f205', area_id: 'area-main', slot_number: 'F2-05', slot_type: 'SUV', floor_number: 2, status: 'AVAILABLE' },
      { slot_id: 'slot-f206', area_id: 'area-main', slot_number: 'F2-06', slot_type: 'SUV', floor_number: 2, status: 'AVAILABLE' },
      { slot_id: 'slot-f207', area_id: 'area-main', slot_number: 'F2-07', slot_type: 'ACCESSIBLE', floor_number: 2, status: 'AVAILABLE' },
      { slot_id: 'slot-f208', area_id: 'area-main', slot_number: 'F2-08', slot_type: 'SEDAN', floor_number: 2, status: 'AVAILABLE' },
      // Floor 3 (Roof Deck / Level 3)
      { slot_id: 'slot-f301', area_id: 'area-main', slot_number: 'F3-01', slot_type: 'EV', floor_number: 3, status: 'AVAILABLE' },
      { slot_id: 'slot-f302', area_id: 'area-main', slot_number: 'F3-02', slot_type: 'EV', floor_number: 3, status: 'AVAILABLE' },
      { slot_id: 'slot-f303', area_id: 'area-main', slot_number: 'F3-03', slot_type: 'SEDAN', floor_number: 3, status: 'AVAILABLE' },
      { slot_id: 'slot-f304', area_id: 'area-main', slot_number: 'F3-04', slot_type: 'SEDAN', floor_number: 3, status: 'AVAILABLE' },
      { slot_id: 'slot-f305', area_id: 'area-main', slot_number: 'F3-05', slot_type: 'SUV', floor_number: 3, status: 'AVAILABLE' },
      { slot_id: 'slot-f306', area_id: 'area-main', slot_number: 'F3-06', slot_type: 'SUV', floor_number: 3, status: 'OCCUPIED' },
      { slot_id: 'slot-f307', area_id: 'area-main', slot_number: 'F3-07', slot_type: 'ACCESSIBLE', floor_number: 3, status: 'AVAILABLE' },
      { slot_id: 'slot-f308', area_id: 'area-main', slot_number: 'F3-08', slot_type: 'MOTORCYCLE', floor_number: 3, status: 'AVAILABLE' }
    ];


    this.reservations = [
      {
        reservation_id: 'res-8812',
        user_id: 'usr-001',
        vehicle_id: 'veh-001',
        slot_id: 'slot-f204',
        start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date(Date.now() + 7200000).toISOString(),
        qr_code_hash: 'QR-RES-8812-ABC1234',
        status: 'CONFIRMED',
        created_at: new Date(Date.now() - 4000000).toISOString()
      }
    ];

    this.payments = [
      {
        payment_id: 'pay-7711',
        reservation_id: 'res-8812',
        amount: 15.00,
        currency: 'USD',
        payment_method: 'VISA_4022',
        status: 'SUCCEEDED',
        transaction_ref: 'TXN-9988-AUTH',
        transaction_date: new Date(Date.now() - 4000000).toISOString()
      }
    ];

    this.parking_logs = [
      {
        log_id: 'log-001',
        vehicle_id: 'veh-001',
        slot_id: 'slot-g02',
        entry_gate: 'NORTH-1',
        exit_gate: null,
        entry_time: new Date(Date.now() - 7200000).toISOString(),
        exit_time: null,
        total_duration_minutes: null
      }
    ];

    this.sensor_data = this.parking_slots.map(s => ({
      sensor_record_id: uuidv4(),
      sensor_id: `SEN-${s.slot_number}`,
      slot_id: s.slot_id,
      status: s.status,
      battery_level: 98.5,
      timestamp: new Date().toISOString()
    }));

    this.security_logs = [
      {
        security_log_id: 'sec-001',
        vehicle_id: null,
        camera_id: 'CAM-NORTH-GATE',
        event_type: 'ANPR_SCAN',
        severity: 'INFO',
        description: 'Vehicle ABC-1234 verified at Entry Gate NORTH-1.',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      }
    ];

    this.agent_logs = [];
    this.notifications = [];
    this.hitl_requests = [
      {
        hitl_id: 'hitl-001',
        type: 'REFUND_REQUEST',
        title: 'Customer Refund: Res #8812 Overcharge',
        requested_by: 'PaymentAgent',
        amount: 5.00,
        user_id: 'usr-001',
        reason: 'Sensor glitch delayed exit registration by 15 mins.',
        status: 'PENDING',
        created_at: new Date(Date.now() - 1800000).toISOString()
      }
    ];

    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event, payload) {
    for (const cb of this.listeners) {
      try {
        cb(event, payload);
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    }
  }
}

export const store = new ParkingStore();
