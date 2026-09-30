import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api';

async function testPhase6Flow() {
  console.log('================================================================');
  console.log('  SECUREWORK VERIFY - PHASE 6: AUDITOR & COMPLIANCE E2E TEST');
  console.log('================================================================\n');

  let passedAssertions = 0;
  let totalAssertions = 0;

  function assert(condition, message) {
    totalAssertions++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedAssertions++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ---------------------------------------------------------
  // Step 1: Authenticate as Auditor Persona
  // ---------------------------------------------------------
  console.log('Step 1: Authenticate as Compliance Auditor (auditor@securework.local)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'auditor@securework.local',
      password: 'AdminSecurePass123!'
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.success, 'Auditor login returns 200 OK');
  assert(loginData.data.user.role === 'AUDITOR', 'Authenticated user role is AUDITOR');
  const token = loginData.data.token;
  const auditorUser = loginData.data.user;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log(`  Auditor Session active: ${auditorUser.name} (${auditorUser.email}, Role: ${auditorUser.role})\n`);

  // ---------------------------------------------------------
  // Step 2: RBAC Gate - Standard User Denied Access to Audit Engine
  // ---------------------------------------------------------
  console.log('Step 2: RBAC Gate -> Verify standard USER cannot inspect or validate audit logs...');
  const userLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'scholar@stanford.edu',
      password: 'SecureUserPass123!'
    })
  });
  const userLoginData = await userLoginRes.json();
  assert(userLoginRes.status === 200 && userLoginData.success, 'Standard USER login returns 200 OK');
  const userToken = userLoginData.data.token;
  
  const forbiddenRes = await fetch(`${BASE_URL}/audit-logs/validate`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(forbiddenRes.status === 403, 'Unauthorized USER is rejected with 403 Forbidden on /audit-logs/validate');
  console.log('  RBAC isolation verified: Standard users cannot access audit verification endpoints.\n');

  // ---------------------------------------------------------
  // Step 3: Retrieve Immutable Hash-Chained Audit Ledger
  // ---------------------------------------------------------
  console.log('Step 3: Retrieve and inspect cryptographic audit log entries...');
  const logsRes = await fetch(`${BASE_URL}/audit-logs?limit=20`, { headers: authHeaders });
  const logsData = await logsRes.json();
  assert(logsRes.status === 200 && logsData.success, 'Auditor can fetch paginated audit log stream');
  const auditLogs = logsData.data.logs || [];
  assert(auditLogs.length > 0, `Audit ledger contains ${auditLogs.length} verified immutable records`);

  const sampleEntry = auditLogs[0];
  const seq = sampleEntry.sequenceNumber !== undefined ? sampleEntry.sequenceNumber : sampleEntry.sequence;
  const prevH = sampleEntry.previousHash || sampleEntry.prevHash;
  assert(typeof seq === 'number', 'Audit entry has numeric sequence number');
  assert(!!sampleEntry.currentHash && sampleEntry.currentHash.length === 64, 'Audit entry has 64-char SHA-256 currentHash');
  assert(!!prevH && prevH.length === 64, 'Audit entry has 64-char SHA-256 previousHash');
  assert(!!sampleEntry.action, `Audit entry records action: ${sampleEntry.action}`);
  console.log(`  Inspected Audit Entry: Seq #${seq} | Action: ${sampleEntry.action} | Hash: ${sampleEntry.currentHash.substring(0, 16)}...\n`);

  // ---------------------------------------------------------
  // Step 4: Execute Cryptographic Hash Chain Validation
  // ---------------------------------------------------------
  console.log('Step 4: Execute Full Genesis-to-Head Cryptographic Hash Chain Validation...');
  const validateRes = await fetch(`${BASE_URL}/audit-logs/validate`, { headers: authHeaders });
  const validateData = await validateRes.json();
  assert(validateRes.status === 200 && validateData.success, 'Chain validation endpoint returns 200 OK');
  
  const validation = validateData.data.validation;
  const isChainValid = validation.valid === true || validation.chainValid === true;
  assert(isChainValid, 'Complete audit log hash-chain is mathematically valid');
  assert((validation.errors || []).length === 0, 'Zero tampering detected across the audit ledger');
  assert(validation.totalRecords >= 1, `Verified ${validation.totalRecords} contiguous audit chain blocks`);
  assert(!!validation.genesisHash && validation.genesisHash.length === 64, 'Genesis block correctly anchors to genesis hash');
  console.log(`  Chain Integrity Confirmed: ${validation.totalRecords} records verified, errors = 0\n`);

  // ---------------------------------------------------------
  // Step 5: Perform Verification Evaluation & Anchor Audit Checkpoint
  // ---------------------------------------------------------
  console.log('Step 5: Trigger Verification Check & Anchor Immutable Audit Checkpoint...');
  
  // First evaluate a verification run so new audit entries exist
  const credsRes = await fetch(`${BASE_URL}/credentials?limit=1`, { headers: authHeaders });
  const credsData = await credsRes.json();
  const sampleCred = credsData.data?.credentials?.[0];

  if (sampleCred) {
    await fetch(`${BASE_URL}/verifications/evaluate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        credentialId: sampleCred.credentialId,
        documentHash: sampleCred.documentHash
      })
    });
  }

  const checkpointRes = await fetch(`${BASE_URL}/audit-logs/checkpoint`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      externalAnchorType: 'INTERNAL_LOCAL'
    })
  });
  const checkpointData = await checkpointRes.json();
  
  if (checkpointRes.status === 201 && checkpointData.success) {
    const checkpoint = checkpointData.data.checkpoint;
    assert(!!checkpoint.checkpointId, `Checkpoint created with ID: ${checkpoint.checkpointId}`);
    const checkpointSeq = checkpoint.sequenceEnd !== undefined ? checkpoint.sequenceEnd : checkpoint.sequenceNumber;
    assert(typeof checkpointSeq === 'number', `Checkpoint anchored at sequence #${checkpointSeq}`);
    const rootHash = checkpoint.chainHeadHash || checkpoint.auditRootHash;
    assert(!!rootHash && rootHash.length === 64, `Anchored root hash: ${rootHash.substring(0, 16)}...`);
    console.log(`  Audit Checkpoint created: ${checkpoint.checkpointId} at Seq #${checkpointSeq}\n`);
  } else {
    // If no new records since last demo checkpoint, verify existing checkpoints
    assert(checkpointData.error?.code === 'NO_NEW_RECORDS' || checkpointRes.status === 201, 'Checkpoint creation guard enforced');
    console.log(`  Checkpoint guard verified: ${checkpointData.error?.message || 'Checkpoint verified'}\n`);
  }

  // ---------------------------------------------------------
  // Step 6: List and Verify Checkpoints
  // ---------------------------------------------------------
  console.log('Step 6: List historical checkpoints and verify anchored states...');
  const listCpRes = await fetch(`${BASE_URL}/audit-logs/checkpoints`, { headers: authHeaders });
  const listCpData = await listCpRes.json();
  assert(listCpRes.status === 200 && listCpData.success, 'List checkpoints endpoint returns 200 OK');
  const checkpoints = listCpData.data.checkpoints || [];
  assert(Array.isArray(checkpoints), 'System returns checkpoint array from audit registry');
  console.log(`  Checkpoints registry active with ${checkpoints.length} record(s).\n`);

  // ---------------------------------------------------------
  // Step 7: Cryptographic Verification Evidence Package Inspection
  // ---------------------------------------------------------
  console.log('Step 7: Auditor inspects complete self-contained cryptographic evidence package...');
  const verifsRes = await fetch(`${BASE_URL}/verifications?limit=5`, { headers: authHeaders });
  const verifsData = await verifsRes.json();
  assert(verifsRes.status === 200 && verifsData.success, 'Auditor can retrieve verification list');
  const verifications = verifsData.data.verifications || [];

  if (verifications.length > 0) {
    const targetVerif = verifications[0];
    const evidenceRes = await fetch(`${BASE_URL}/verifications/${targetVerif.verificationId}/evidence`, { headers: authHeaders });
    const evidenceData = await evidenceRes.json();
    assert(evidenceRes.status === 200 && evidenceData.success, 'Auditor can retrieve full evidence package by verificationId');
    const evidenceList = evidenceData.data.evidence || [];
    assert(evidenceList.length > 0, `Retrieved ${evidenceList.length} cryptographic evidence record(s)`);
    
    const primaryEvidence = evidenceList[0];
    assert(primaryEvidence.verificationId === targetVerif.verificationId, 'Evidence package correctly binds to verificationId');
    console.log(`  Evidence Package verified for verification ${targetVerif.verificationId}\n`);
  }

  // ---------------------------------------------------------
  // Step 8: Assert Audit Immutability (No DELETE/UPDATE Routes)
  // ---------------------------------------------------------
  console.log('Step 8: Immutability Assurance -> Confirm DELETE / UPDATE are strictly disabled on audit logs...');
  const deleteRes = await fetch(`${BASE_URL}/audit-logs/${sampleEntry._id || sampleEntry.auditId || '123'}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(deleteRes.status === 404 || deleteRes.status === 405, 'DELETE method on audit logs returns 404/405 (Disallowed)');

  const putRes = await fetch(`${BASE_URL}/audit-logs/${sampleEntry._id || sampleEntry.auditId || '123'}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ action: 'MUTATED_ACTION' })
  });
  assert(putRes.status === 404 || putRes.status === 405, 'PUT method on audit logs returns 404/405 (Disallowed)');
  console.log('  Audit immutability verified: Audit records cannot be modified or deleted via API.\n');

  console.log('================================================================');
  console.log(`  PHASE 6 AUDITOR & COMPLIANCE E2E TEST: ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED!`);
  console.log('================================================================\n');
}

testPhase6Flow().catch((err) => {
  console.error('\n  Phase 6 test error:', err);
  process.exit(1);
});
