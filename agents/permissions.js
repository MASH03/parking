// agents/permissions.js
// Authoritative Agent-to-Tool Permission Matrix (§4 of Specification)

export const PERMISSION_MATRIX = {
  SearchParkingSlots: ['AvailabilityAgent', 'ReservationAgent', 'CustomerSupportAgent'],
  CheckSlotAvailability: ['AvailabilityAgent', 'ReservationAgent', 'MaintenanceAgent'],
  ReserveParkingSlot: ['ReservationAgent'],
  CancelReservation: ['ReservationAgent', 'CustomerSupportAgent'],
  CalculateParkingFee: ['PaymentAgent', 'EntryExitAgent', 'CustomerSupportAgent'],
  ProcessPayment: ['PaymentAgent'],
  VerifyPayment: ['PaymentAgent', 'EntryExitAgent'],
  GenerateReceipt: ['PaymentAgent'],
  RegisterVehicleEntry: ['EntryExitAgent'],
  RegisterVehicleExit: ['EntryExitAgent'],
  VerifyQRCode: ['EntryExitAgent', 'SecurityAgent'],
  VerifyVehicle: ['EntryExitAgent', 'SecurityAgent'],
  ReadParkingSensor: ['AvailabilityAgent', 'MaintenanceAgent'],
  AnalyzeCameraFeed: ['SecurityAgent', 'EntryExitAgent'],
  SendNotification: ['NotificationAgent'],
  CreateMaintenanceTicket: ['MaintenanceAgent'],
  GenerateParkingReport: ['AnalyticsAgent']
};

/**
 * Validates if a specific agent is authorized to execute a requested tool.
 * The Orchestrator itself calls NO business tools directly (it must delegate).
 */
export function validateAgentPermission(agentName, toolName) {
  if (agentName === 'Orchestrator' || agentName === 'AIOrchestrator') {
    return {
      allowed: false,
      reason: 'ARCHITECTURAL_VIOLATION: The AI Orchestrator cannot call tools directly; it must delegate to a specialized agent.'
    };
  }

  const allowedAgents = PERMISSION_MATRIX[toolName];
  if (!allowedAgents) {
    return {
      allowed: false,
      reason: `UNKNOWN_TOOL: Tool '${toolName}' is not recognized in the system permission matrix.`
    };
  }

  if (!allowedAgents.includes(agentName)) {
    return {
      allowed: false,
      reason: `PERMISSION_DENIED: Agent '${agentName}' is not authorized to invoke '${toolName}'. Allowed agents: [${allowedAgents.join(', ')}].`
    };
  }

  return { allowed: true };
}
