// tests/unit/agent_test.js
// Automated verification suite for the Parking System Agentic AI Factory

import { orchestrator } from '../../agents/orchestrator/orchestrator.js';
import { executeTool } from '../../tools/index.js';
import { validateAgentPermission } from '../../agents/permissions.js';

async function runTests() {
  console.log('🧪 Starting Parking System Agentic AI Factory Test Suite...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Permission Matrix Guard (Zero-Trust)
  try {
    const perm1 = validateAgentPermission('Orchestrator', 'SearchParkingSlots');
    if (!perm1.allowed && perm1.reason.includes('cannot call tools directly')) {
      console.log('✅ Test 1 Passed: AI Orchestrator is strictly barred from direct tool execution.');
      passed++;
    } else {
      console.error('❌ Test 1 Failed: Orchestrator permission bypass detected.');
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 1 Error:', err);
    failed++;
  }

  // Test 2: Unauthorized Tool Invocation Prevention
  try {
    const perm2 = validateAgentPermission('CustomerSupportAgent', 'ProcessPayment');
    if (!perm2.allowed && perm2.reason.includes('PERMISSION_DENIED')) {
      console.log('✅ Test 2 Passed: CustomerSupportAgent barred from invoking ProcessPayment().');
      passed++;
    } else {
      console.error('❌ Test 2 Failed: Unauthorized agent allowed to call payment tool.');
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 2 Error:', err);
    failed++;
  }

  // Test 3: Authorized Tool Execution
  try {
    const feeRes = await executeTool('PaymentAgent', 'CalculateParkingFee', { duration_hours: 3, slot_type: 'EV' });
    if (feeRes.success && feeRes.data.total_amount > 0) {
      console.log(`✅ Test 3 Passed: PaymentAgent calculated fee: $${feeRes.data.total_amount}.`);
      passed++;
    } else {
      console.error('❌ Test 3 Failed:', feeRes.error);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 3 Error:', err);
    failed++;
  }

  // Test 4: AI Orchestrator End-to-End Multi-Agent DAG Execution
  try {
    const trace = await orchestrator.processUserRequest('Find an available EV slot on Floor 1');
    if (trace.steps.length >= 2 && trace.steps[0].agent === 'AvailabilityAgent' && trace.final_response) {
      console.log(`✅ Test 4 Passed: Orchestrator executed DAG (${trace.steps.length} hops) in ${trace.total_latency_ms}ms.`);
      passed++;
    } else {
      console.error('❌ Test 4 Failed: Invalid DAG execution trace.', trace);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 4 Error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
