// agents/orchestrator/orchestrator.js
// Central AI Orchestrator Agent (§2 & §7 of Specification)
// Orchestrates multi-agent execution DAGs, enforces permissions, and aggregates final responses.

import { v4 as uuidv4 } from 'uuid';
import { AgentRegistry } from '../specialized_agents.js';
import { store } from '../../database/store.js';

export class AIOrchestrator {
  constructor() {
    this.name = 'AIOrchestrator';
  }

  /**
   * Main entrypoint: Processes user prompt, plans DAG, coordinates agents, returns structured execution trace.
   */
  async processUserRequest(userInput, userContext = {}) {
    const traceId = `trc_${uuidv4().slice(0, 8)}`;
    const startTime = Date.now();

    // 1. Intent Detection & Entity Extraction
    const parsedIntent = this.detectIntent(userInput);

    // 2. Task Decomposition (DAG Planning)
    const executionPlan = this.decomposeTask(parsedIntent, userInput, userContext);

    const stepTraces = [];
    let accumulatedState = { ...userContext };
    let hasFailure = false;

    // 3. Sequential / Parallel Agent Delegation Loop
    for (const step of executionPlan.dag) {
      const stepStart = Date.now();
      const agent = AgentRegistry[step.agent];

      if (!agent) {
        stepTraces.push({
          step_id: step.id,
          agent: step.agent,
          status: 'FAILED',
          error: `Agent '${step.agent}' does not exist in the factory.`,
          latency_ms: Date.now() - stepStart
        });
        hasFailure = true;
        break;
      }

      // Merge dynamic parameters resolved from previous steps
      const resolvedParams = this.resolveParameters(step.params, accumulatedState);

      // Delegate to specialized agent
      try {
        const agentResult = await agent.handleTask({
          action: step.action,
          params: resolvedParams
        });

        const stepLatency = Date.now() - stepStart;
        const traceItem = {
          step_id: step.id,
          agent: step.agent,
          action: step.action,
          params: resolvedParams,
          result: agentResult,
          status: agentResult.success ? 'SUCCESS' : 'FAILED',
          latency_ms: stepLatency
        };

        stepTraces.push(traceItem);

        if (agentResult.success) {
          accumulatedState = { ...accumulatedState, ...agentResult.data };
        } else {
          hasFailure = true;
          break;
        }
      } catch (err) {
        stepTraces.push({
          step_id: step.id,
          agent: step.agent,
          action: step.action,
          status: 'ERROR',
          error: err.message,
          latency_ms: Date.now() - stepStart
        });
        hasFailure = true;
        break;
      }
    }

    // 4. Synthesize Final Response
    const finalResponse = this.synthesizeResponse(parsedIntent, accumulatedState, hasFailure, stepTraces);
    const totalLatency = Date.now() - startTime;

    const fullTrace = {
      trace_id: traceId,
      intent: parsedIntent.intent,
      confidence: parsedIntent.confidence,
      plan: executionPlan.dag,
      steps: stepTraces,
      final_response: finalResponse,
      state_snapshot: accumulatedState,
      total_latency_ms: totalLatency,
      timestamp: new Date().toISOString()
    };

    // Log orchestration trace in DB
    store.agent_logs.unshift({
      agent_log_id: uuidv4(),
      conversation_id: traceId,
      agent_name: 'AIOrchestrator',
      action: parsedIntent.intent,
      request_payload: { prompt: userInput, userContext },
      result_payload: fullTrace,
      execution_latency_ms: totalLatency,
      timestamp: new Date().toISOString()
    });

    return fullTrace;
  }

  detectIntent(text) {
    const lower = text.toLowerCase();

    if (lower.includes('reserve') || lower.includes('book') || lower.includes('park slot')) {
      return { intent: 'RESERVE_PARKING', confidence: 0.98 };
    }
    if (lower.includes('cancel') || lower.includes('unbook')) {
      return { intent: 'CANCEL_RESERVATION', confidence: 0.97 };
    }
    if (lower.includes('find') || lower.includes('available') || lower.includes('empty') || lower.includes('open slot') || lower.includes('ev slot')) {
      return { intent: 'FIND_PARKING', confidence: 0.96 };
    }
    if (lower.includes('enter') || lower.includes('gate entry') || lower.includes('barrier open') || lower.includes('arrived')) {
      return { intent: 'SIMULATE_ENTRY', confidence: 0.95 };
    }
    if (lower.includes('exit') || lower.includes('leave') || lower.includes('gate exit')) {
      return { intent: 'SIMULATE_EXIT', confidence: 0.95 };
    }
    if (lower.includes('security') || lower.includes('suspicious') || lower.includes('threat') || lower.includes('alert') || lower.includes('blacklist')) {
      return { intent: 'SECURITY_ALERT', confidence: 0.94 };
    }
    if (lower.includes('cost') || lower.includes('fee') || lower.includes('price') || lower.includes('rate') || lower.includes('how much')) {
      return { intent: 'CALCULATE_FEE', confidence: 0.96 };
    }
    if (lower.includes('sensor') || lower.includes('malfunction') || lower.includes('broken') || lower.includes('maintenance')) {
      return { intent: 'MAINTENANCE_STATUS', confidence: 0.93 };
    }
    if (lower.includes('report') || lower.includes('occupancy') || lower.includes('analytics') || lower.includes('revenue') || lower.includes('stats')) {
      return { intent: 'ANALYTICS_REPORT', confidence: 0.96 };
    }
    return { intent: 'GENERAL_SUPPORT', confidence: 0.85 };
  }

  decomposeTask(intentObj, rawText, context) {
    const lower = rawText.toLowerCase();

    // Floor extraction
    let floorNumber = 1;
    if (lower.includes('floor 2') || lower.includes('2nd floor') || lower.includes('second floor') || lower.includes('f2')) {
      floorNumber = 2;
    } else if (lower.includes('floor 3') || lower.includes('3rd floor') || lower.includes('third floor') || lower.includes('f3') || lower.includes('roof deck') || lower.includes('level 3')) {
      floorNumber = 3;
    }

    // Slot type extraction
    let slotType = 'SEDAN';
    if (lower.includes('ev') || lower.includes('electric') || lower.includes('charging')) slotType = 'EV';
    if (lower.includes('suv') || lower.includes('truck')) slotType = 'SUV';
    if (lower.includes('accessible') || lower.includes('handicap') || lower.includes('disabled')) slotType = 'ACCESSIBLE';
    if (lower.includes('motorcycle') || lower.includes('bike')) slotType = 'MOTORCYCLE';

    // Plate extraction regex
    const plateMatch = rawText.match(/([A-Z0-9]{2,4}-[0-9]{3,4}|[A-Z0-9]{6,8})/i);
    const plateNumber = plateMatch ? plateMatch[1].toUpperCase() : 'ABC-1234';

    // Specific slot match (e.g. A-15, G-03, F2-04)
    const slotMatch = rawText.match(/([GgFf][12]?-\d{2})/);
    const specificSlot = slotMatch ? slotMatch[1].toUpperCase() : null;

    switch (intentObj.intent) {
      case 'FIND_PARKING':
        return {
          dag: [
            { id: 'step_1', agent: 'AvailabilityAgent', action: 'SEARCH_AVAILABLE', params: { floor_number: floorNumber, slot_type: slotType } },
            { id: 'step_2', agent: 'CustomerSupportAgent', action: 'CALCULATE_ESTIMATE', params: { slot_type: slotType, duration_hours: 2 } }
          ]
        };

      case 'RESERVE_PARKING':
        return {
          dag: [
            { id: 'step_1', agent: 'AvailabilityAgent', action: 'SEARCH_AVAILABLE', params: { floor_number: floorNumber, slot_type: slotType } },
            { id: 'step_2', agent: 'ReservationAgent', action: 'CREATE_RESERVATION', params: { slot_number: specificSlot, slot_type: slotType, plate_number: plateNumber } },
            { id: 'step_3', agent: 'PaymentAgent', action: 'PROCESS_PAYMENT', params: { amount: 15.00 } },
            { id: 'step_4', agent: 'NotificationAgent', action: 'SEND_ALERT', params: { type: 'RESERVATION_CONFIRMATION' } }
          ]
        };

      case 'CANCEL_RESERVATION':
        return {
          dag: [
            { id: 'step_1', agent: 'ReservationAgent', action: 'CANCEL_RESERVATION', params: { reservation_id: 'res-8812' } },
            { id: 'step_2', agent: 'NotificationAgent', action: 'SEND_ALERT', params: { type: 'CANCELLATION_NOTICE' } }
          ]
        };

      case 'SIMULATE_ENTRY':
        return {
          dag: [
            { id: 'step_1', agent: 'EntryExitAgent', action: 'PROCESS_ENTRY', params: { plate_number: plateNumber, gate_id: 'NORTH-1' } },
            { id: 'step_2', agent: 'NotificationAgent', action: 'SEND_ALERT', params: { type: 'ENTRY_RECORDED' } }
          ]
        };

      case 'SIMULATE_EXIT':
        return {
          dag: [
            { id: 'step_1', agent: 'PaymentAgent', action: 'CALCULATE_FEE', params: { duration_hours: 3 } },
            { id: 'step_2', agent: 'EntryExitAgent', action: 'PROCESS_EXIT', params: { plate_number: plateNumber, gate_id: 'EXIT-1' } }
          ]
        };

      case 'SECURITY_ALERT':
        return {
          dag: [
            { id: 'step_1', agent: 'SecurityAgent', action: 'SECURITY_CHECK', params: { plate_number: plateNumber } },
            { id: 'step_2', agent: 'NotificationAgent', action: 'SEND_ALERT', params: { type: 'SECURITY_INCIDENT_ALERT' } }
          ]
        };

      case 'CALCULATE_FEE':
        return {
          dag: [
            { id: 'step_1', agent: 'PaymentAgent', action: 'CALCULATE_FEE', params: { duration_hours: 3, slot_type: slotType } }
          ]
        };

      case 'MAINTENANCE_STATUS':
        return {
          dag: [
            { id: 'step_1', agent: 'MaintenanceAgent', action: 'CHECK_HARDWARE', params: { slot_number: 'G-07' } },
            { id: 'step_2', agent: 'MaintenanceAgent', action: 'CREATE_TICKET', params: { device_id: 'SEN-G-07', severity: 'HIGH' } }
          ]
        };

      case 'ANALYTICS_REPORT':
        return {
          dag: [
            { id: 'step_1', agent: 'AnalyticsAgent', action: 'GET_REPORT', params: {} }
          ]
        };

      default:
        return {
          dag: [
            { id: 'step_1', agent: 'CustomerSupportAgent', action: 'GENERAL_INFO', params: {} }
          ]
        };
    }
  }

  resolveParameters(params, accumulatedState) {
    const resolved = { ...params };
    if (accumulatedState.slot_number && !resolved.slot_number) {
      resolved.slot_number = accumulatedState.slot_number;
    }
    if (accumulatedState.reservation_id && !resolved.reservation_id) {
      resolved.reservation_id = accumulatedState.reservation_id;
    }
    return resolved;
  }

  synthesizeResponse(intentObj, state, hasFailure, traces) {
    if (hasFailure) {
      const failedStep = traces.find(t => t.status === 'FAILED' || t.status === 'ERROR');
      return `❌ Task could not be completed: ${failedStep ? (failedStep.error || failedStep.result?.error) : 'Internal agent execution error.'}`;
    }

    switch (intentObj.intent) {
      case 'FIND_PARKING': {
        const slots = state.slots || [];
        if (slots.length > 0) {
          const slotListStr = slots.slice(0, 3).map(s => `**${s.slot_number}** (Floor ${s.floor_number} • ${s.slot_type})`).join(', ');
          return `Found **${state.total_found}** available slot(s). Recommended: ${slotListStr}. Estimated base fee is **$${state.total_amount || '10.80'}** for 2 hours.`;
        }
        // If 0 found on requested floor, check other floors in store
        const otherSlots = store.parking_slots.filter(s => s.status === 'AVAILABLE');
        if (otherSlots.length > 0) {
          const altList = otherSlots.slice(0, 3).map(s => `**${s.slot_number}** (Floor ${s.floor_number} • ${s.slot_type})`).join(', ');
          return `ℹ️ No available slots on the requested level, but found **${otherSlots.length}** open slot(s) elsewhere: ${altList}. Would you like to reserve one of these?`;
        }
        return `⚠️ Garage is currently at full capacity for this slot type. Please check back shortly or select another vehicle tier.`;
      }

      case 'RESERVE_PARKING':
        return `✅ Reservation confirmed! Slot **${state.slot_number}** (Floor ${state.floor_number}) has been secured for vehicle **${state.plate_number}**. Reservation ID: **${state.reservation_id}**. Payment of **$${state.amount || '15.00'}** processed. Your digital QR pass is ready!`;

      case 'CANCEL_RESERVATION':
        return `🗑️ Reservation **${state.reservation_id}** has been cancelled successfully. Slot **${state.slot_freed || 'assigned slot'}** has been released back to public availability.`;

      case 'SIMULATE_ENTRY':
        return `🚗 Ingress verified for **${state.plate_number}** at Gate **${state.gate}**. Assigned space: **${state.assigned_slot}**. Barrier raised!`;

      case 'SIMULATE_EXIT':
        return `👋 Vehicle **${state.plate_number}** cleared for departure via **${state.gate}**. Total duration: **${state.duration_minutes} mins**. Slot **${state.freed_slot}** marked available. Safe travels!`;

      case 'SECURITY_ALERT':
        return `🛡️ Security assessment complete. Threat Level: **${state.threat_level || 'NORMAL'}**. Surveillance frame analyzed at ${state.feed?.camera_id || 'North Gate'}. Security dispatch alerted.`;

      case 'CALCULATE_FEE':
        return `💳 Estimated parking fee for **${state.duration_hours} hours** (${state.slot_type}): Base amount **$${state.base_amount}** + Tax **$${state.tax}** = **$${state.total_amount} ${state.currency}**.`;

      case 'MAINTENANCE_STATUS':
        return `🔧 Sensor telemetry checked for device **${state.device_id || 'SEN-G-07'}**. Maintenance ticket **${state.ticket_id || 'TICK-402'}** generated with severity **HIGH**. Field technician Carlos Ramos assigned.`;

      case 'ANALYTICS_REPORT': {
        const m = state.metrics || {};
        return `📊 **${state.facility_name || 'Grand Central Smart Garage'} Daily Report**:\n- Total Capacity: **${m.total_slots}** slots\n- Occupancy Rate: **${m.occupancy_rate_percent}%** (${m.occupied_slots} occupied, ${m.reserved_slots} reserved)\n- Available Slots: **${m.available_slots}**\n- Daily Revenue: **$${m.total_revenue_usd}**\n- Peak Period: **${m.peak_occupancy_hour}**`;
      }

      default:
        return state.message || `Welcome to the Parking System Agentic AI Factory! How may our specialized agents assist your parking operations today?`;
    }
  }
}

export const orchestrator = new AIOrchestrator();
