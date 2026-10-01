// agents/specialized_agents.js
// 10 Specialized AI Agents with Narrow Responsibilities and Scoped Tool Invocations

import { executeTool } from '../tools/index.js';

// 1. Parking Availability Agent
export const AvailabilityAgent = {
  name: 'AvailabilityAgent',
  description: 'Tracks real-time slot occupancy, sensor streams, and zone-level availability.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'SEARCH_AVAILABLE') {
      const res = await executeTool('AvailabilityAgent', 'SearchParkingSlots', params);
      return { agent: 'AvailabilityAgent', action, success: res.success, data: res.data, error: res.error };
    }
    if (action === 'CHECK_SLOT') {
      const res = await executeTool('AvailabilityAgent', 'CheckSlotAvailability', params);
      return { agent: 'AvailabilityAgent', action, success: res.success, data: res.data, error: res.error };
    }
    if (action === 'READ_SENSOR') {
      const res = await executeTool('AvailabilityAgent', 'ReadParkingSensor', params);
      return { agent: 'AvailabilityAgent', action, success: res.success, data: res.data, error: res.error };
    }
    return { agent: 'AvailabilityAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 2. Reservation Agent
export const ReservationAgent = {
  name: 'ReservationAgent',
  description: 'Manages slot reservation lifecycle, conflict locking, and cancellations.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'CREATE_RESERVATION') {
      const res = await executeTool('ReservationAgent', 'ReserveParkingSlot', params);
      return { agent: 'ReservationAgent', action, success: res.success, data: res.data, error: res.error };
    }
    if (action === 'CANCEL_RESERVATION') {
      const res = await executeTool('ReservationAgent', 'CancelReservation', params);
      return { agent: 'ReservationAgent', action, success: res.success, data: res.data, error: res.error };
    }
    return { agent: 'ReservationAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 3. Payment Agent
export const PaymentAgent = {
  name: 'PaymentAgent',
  description: 'Calculates parking fees, executes payments, and generates receipts.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'CALCULATE_FEE') {
      const res = await executeTool('PaymentAgent', 'CalculateParkingFee', params);
      return { agent: 'PaymentAgent', action, success: res.success, data: res.data, error: res.error };
    }
    if (action === 'PROCESS_PAYMENT') {
      const res = await executeTool('PaymentAgent', 'ProcessPayment', params);
      return { agent: 'PaymentAgent', action, success: res.success, data: res.data, error: res.error };
    }
    if (action === 'GENERATE_RECEIPT') {
      const res = await executeTool('PaymentAgent', 'GenerateReceipt', params);
      return { agent: 'PaymentAgent', action, success: res.success, data: res.data, error: res.error };
    }
    return { agent: 'PaymentAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 4. Entry & Exit Agent
export const EntryExitAgent = {
  name: 'EntryExitAgent',
  description: 'Processes automated barrier control, ANPR plate ingress/egress, and durations.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'PROCESS_ENTRY') {
      // First verify plate
      const verifyRes = await executeTool('EntryExitAgent', 'VerifyVehicle', params);
      if (verifyRes.data && verifyRes.data.is_blacklisted) {
        return { agent: 'EntryExitAgent', success: false, access_denied: true, reason: 'Vehicle is flagged on security blacklist.' };
      }
      const entryRes = await executeTool('EntryExitAgent', 'RegisterVehicleEntry', params);
      return { agent: 'EntryExitAgent', action, success: entryRes.success, data: entryRes.data, verification: verifyRes.data };
    }
    if (action === 'PROCESS_EXIT') {
      const exitRes = await executeTool('EntryExitAgent', 'RegisterVehicleExit', params);
      return { agent: 'EntryExitAgent', action, success: exitRes.success, data: exitRes.data };
    }
    return { agent: 'EntryExitAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 5. Security Agent
export const SecurityAgent = {
  name: 'SecurityAgent',
  description: 'Monitors vision feeds, detects anomalies, flags unknown or blacklisted plates.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'ANALYZE_FEED' || action === 'SECURITY_CHECK') {
      const visionRes = await executeTool('SecurityAgent', 'AnalyzeCameraFeed', params);
      const vehicleCheck = await executeTool('SecurityAgent', 'VerifyVehicle', { plate_number: params.plate_number || 'ABC-1234' });
      return {
        agent: 'SecurityAgent',
        action,
        success: true,
        data: {
          feed: visionRes.data,
          vehicle_profile: vehicleCheck.data,
          threat_level: vehicleCheck.data?.is_blacklisted ? 'CRITICAL' : 'NORMAL'
        }
      };
    }
    return { agent: 'SecurityAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 6. Customer Support Agent
export const CustomerSupportAgent = {
  name: 'CustomerSupportAgent',
  description: 'Answers customer inquiries regarding tariffs, floor directions, and amenities.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'CALCULATE_ESTIMATE') {
      const res = await executeTool('CustomerSupportAgent', 'CalculateParkingFee', params);
      return { agent: 'CustomerSupportAgent', action, success: res.success, data: res.data };
    }
    if (action === 'CHECK_AVAILABILITY') {
      const res = await executeTool('CustomerSupportAgent', 'SearchParkingSlots', params);
      return { agent: 'CustomerSupportAgent', action, success: res.success, data: res.data };
    }
    return {
      agent: 'CustomerSupportAgent',
      success: true,
      data: {
        message: 'Grand Central Smart Garage operates 24/7 with EV charging on Floor 1 & 2, ADA accessible slots, and automated ANPR barrier gates.'
      }
    };
  }
};

// 7. Maintenance Agent
export const MaintenanceAgent = {
  name: 'MaintenanceAgent',
  description: 'Monitors IoT sensor telemetry, identifies hardware anomalies, and creates repair tickets.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'CHECK_HARDWARE') {
      const sensorRes = await executeTool('MaintenanceAgent', 'ReadParkingSensor', params);
      return { agent: 'MaintenanceAgent', action, success: true, data: sensorRes.data };
    }
    if (action === 'CREATE_TICKET') {
      const ticketRes = await executeTool('MaintenanceAgent', 'CreateMaintenanceTicket', params);
      return { agent: 'MaintenanceAgent', action, success: ticketRes.success, data: ticketRes.data };
    }
    return { agent: 'MaintenanceAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 8. Analytics Agent
export const AnalyticsAgent = {
  name: 'AnalyticsAgent',
  description: 'Aggregates facility occupancy, revenue metrics, and peak period forecasts.',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'GET_REPORT' || action === 'GENERATE_INSIGHTS') {
      const reportRes = await executeTool('AnalyticsAgent', 'GenerateParkingReport', params || {});
      return { agent: 'AnalyticsAgent', action, success: reportRes.success, data: reportRes.data };
    }
    return { agent: 'AnalyticsAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// 9. Notification Agent
export const NotificationAgent = {
  name: 'NotificationAgent',
  description: 'Dispatches asynchronous multichannel alerts (Push, SMS, Email).',
  async handleTask(task) {
    const { action, params } = task;
    if (action === 'SEND_ALERT' || action === 'DISPATCH') {
      const res = await executeTool('NotificationAgent', 'SendNotification', params);
      return { agent: 'NotificationAgent', action, success: res.success, data: res.data };
    }
    return { agent: 'NotificationAgent', success: false, error: `Unsupported action: ${action}` };
  }
};

// Agent Registry Map
export const AgentRegistry = {
  AvailabilityAgent,
  ReservationAgent,
  PaymentAgent,
  EntryExitAgent,
  SecurityAgent,
  CustomerSupportAgent,
  MaintenanceAgent,
  AnalyticsAgent,
  NotificationAgent
};
