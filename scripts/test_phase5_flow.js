import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api';

async function testPhase5Flow() {
  console.log('================================================================');
  console.log('  SECUREWORK VERIFY - PHASE 5: HR / VERIFIER PERSONA E2E TEST');
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
  // Step 1: Authenticate as HR Persona (HR Dashboard)
  // ---------------------------------------------------------
  console.log('Step 1: Authenticate as HR Talent Verifier (hr_lead@enterprise.local)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hr_lead@enterprise.local',
      password: 'SecureUserPass123!'
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.success, 'HR user login returns 200 OK');
  assert(loginData.data.user.role === 'HR', 'Authenticated user role is HR');
  const token = loginData.data.token;
  const hrUser = loginData.data.user;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log(`  HR Session established: ${hrUser.name} (${hrUser.email}, Role: ${hrUser.role})\n`);

  // ---------------------------------------------------------
  // Step 2: HR Dashboard Data Acquisition
  // ---------------------------------------------------------
  console.log('Step 2: HR Dashboard -> Retrieve Candidate Qualifications for Verification...');
  const credsRes = await fetch(`${BASE_URL}/credentials?limit=10`, { headers: authHeaders });
  const credsData = await credsRes.json();
  assert(credsRes.status === 200 && credsData.success, 'HR can list applicant candidate credentials');
  const credentials = credsData.data.credentials || [];
  assert(credentials.length > 0, 'Candidate qualifications exist in the system');
  const targetCred = credentials.find(c => c.status === 'ACTIVE') || credentials[0];
  assert(!!targetCred && !!targetCred.credentialId, `Candidate qualification located: ${targetCred.title} (${targetCred.credentialId})`);
  console.log(`  Candidate Target: ${targetCred.title}`);
  console.log(`  Candidate Credential ID: ${targetCred.credentialId}\n`);

  // ---------------------------------------------------------
  // Step 3: Verify Document via Verification Engine
  // ---------------------------------------------------------
  console.log('Step 3: Verify Document -> Trigger 16-Check Verification Engine...');
  const evalRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      credentialId: targetCred.credentialId
    })
  });
  const evalData = await evalRes.json();
  assert(evalRes.status === 200 && evalData.success, 'Evaluation endpoint returns 200 OK');
  const verificationResult = evalData.data;
  assert(!!verificationResult.verificationId, `Real Verification ID generated: ${verificationResult.verificationId}`);
  assert(verificationResult.result === 'VERIFIED', `Verification Engine evaluated result: ${verificationResult.result}`);
  assert(verificationResult.cryptographicStatus === 'PASSED', `Cryptographic status verified: ${verificationResult.cryptographicStatus}`);
  assert(verificationResult.checks.digitalSignature.passed === true, 'Digital signature check passed');
  assert(verificationResult.checks.documentIntegrity.passed === true, 'Document integrity check passed');
  assert(verificationResult.checks.issuerAuthorization.passed === true, 'Issuer authorization check passed');
  console.log(`  Verification Result: ${verificationResult.result}`);
  console.log(`  Trust Level: ${verificationResult.trustLevel}`);
  console.log(`  Explanation: ${verificationResult.explanation}\n`);

  // ---------------------------------------------------------
  // Step 4: Inspect Discrete Evidence Records
  // ---------------------------------------------------------
  console.log('Step 4: Evidence -> Inspect Discrete Immutable Evidence Package for Verification...');
  const evidenceRes = await fetch(`${BASE_URL}/verifications/${verificationResult.verificationId}/evidence`, { headers: authHeaders });
  const evidenceData = await evidenceRes.json();
  assert(evidenceRes.status === 200 && evidenceData.success, 'Fetch verification evidence returns 200 OK');
  const evidenceRecords = evidenceData.data.evidence || [];
  assert(evidenceRecords.length > 0, `Discrete evidence records preserved: count = ${evidenceRecords.length}`);
  
  const sigEvidence = evidenceRecords.find(e => e.evidenceType === 'DIGITAL_SIGNATURE');
  assert(!!sigEvidence, 'Digital signature discrete evidence record exists');
  assert(sigEvidence.signatureValid === true, 'Digital signature marked as valid in evidence store');
  assert(sigEvidence.evidenceStatus === 'CONFIRMED', 'Digital signature evidenceStatus is CONFIRMED');

  const hashEvidence = evidenceRecords.find(e => e.evidenceType === 'HASH_MATCH');
  assert(!!hashEvidence, 'Document hash match discrete evidence record exists');
  assert(hashEvidence.evidenceStatus === 'CONFIRMED', 'Document integrity evidenceStatus is CONFIRMED');
  console.log(`  Evidence Types verified: ${evidenceRecords.map(e => e.evidenceType).join(', ')}\n`);

  // ---------------------------------------------------------
  // Step 5: Verification Logs & HR Manual Review
  // ---------------------------------------------------------
  console.log('Step 5: Verification Logs -> Inspect Verification Log and Submit HR Review...');
  const singleVerRes = await fetch(`${BASE_URL}/verifications/${verificationResult.verificationId}`, { headers: authHeaders });
  const singleVerData = await singleVerRes.json();
  assert(singleVerRes.status === 200 && singleVerData.success, 'Fetch single verification record returns 200 OK');
  assert(singleVerData.data.verification.verificationId === verificationResult.verificationId, 'Exact verification ID confirmed');

  // Submit HR Authoritative Review
  const reviewRes = await fetch(`${BASE_URL}/verifications/${verificationResult.verificationId}/manual-review`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      decision: 'CONFIRMED',
      reviewNotes: 'HR Verifier confirmed candidate academic credentials directly with institutional records.'
    })
  });
  const reviewData = await reviewRes.json();
  assert(reviewRes.status === 200 && reviewData.success, 'HR user can submit authoritative manual review');
  assert(reviewData.data.verification.humanVerificationStatus === 'CONFIRMED', 'Human verification status updated to CONFIRMED');
  assert(reviewData.data.verification.finalResult === 'MANUALLY_VERIFIED', 'Final result promoted to MANUALLY_VERIFIED');
  console.log(`  HR Review Decision: ${reviewData.data.verification.humanVerificationStatus}`);
  console.log(`  Final Result after Review: ${reviewData.data.verification.finalResult}\n`);

  // ---------------------------------------------------------
  // Step 6: Verify Official Source Workflow
  // ---------------------------------------------------------
  console.log('Step 6: Verify Official Source -> Query Trusted Source Registry...');
  const sourcesRes = await fetch(`${BASE_URL}/trusted-sources`, { headers: authHeaders });
  const sourcesData = await sourcesRes.json();
  assert(sourcesRes.status === 200 && sourcesData.success, 'Fetch trusted sources returns 200 OK');
  const sources = sourcesData.data.trustedSources || sourcesData.data.sources || [];
  assert(sources.length > 0, 'Active trusted sources exist in registry');
  const activeSource = sources.find(s => s.status === 'ACTIVE' && s.verificationStatus === 'VERIFIED') || sources[0];
  assert(!!activeSource, `Selected Active Whitelisted Source: ${activeSource.name} (${activeSource.sourceCode})`);

  // Query official source with real candidate credential
  const queryRes = await fetch(`${BASE_URL}/verifications/verify-source`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sourceCode: activeSource.sourceCode,
      queryParams: {
        identifier: targetCred.credentialId
      }
    })
  });
  const queryData = await queryRes.json();
  assert(queryRes.status === 200 && queryData.success, 'Official source verification endpoint returns 200 OK');
  const sourceResult = queryData.data;
  assert(sourceResult.verified === true, 'Official source query confirmed candidate record');
  assert(sourceResult.sourceState === 'SOURCE_VERIFIED' || sourceResult.sourceState === 'SOURCE_FOUND', `Source state: ${sourceResult.sourceState}`);
  assert(!!sourceResult.responseHash && sourceResult.responseHash.length === 64, 'Authentic SHA-256 response digest computed');
  assert(!!sourceResult.verificationId, `Exact verificationId generated for source check: ${sourceResult.verificationId}`);
  console.log(`  Source Query Result: Verified = ${sourceResult.verified}, State = ${sourceResult.sourceState}`);
  console.log(`  Source Verification ID: ${sourceResult.verificationId}\n`);

  // ---------------------------------------------------------
  // Step 7: Open Exact Source Verification and Its Evidence
  // ---------------------------------------------------------
  console.log('Step 7: Assert HR can open exact verification and evidence for official source query...');
  const sourceVerCheck = await fetch(`${BASE_URL}/verifications/${sourceResult.verificationId}`, { headers: authHeaders });
  const sourceVerData = await sourceVerCheck.json();
  assert(sourceVerCheck.status === 200 && sourceVerData.success, 'HR can open exact official source verification by ID');
  assert(sourceVerData.data.verification.verificationId === sourceResult.verificationId, 'Exact source verification ID matches');

  const sourceEvidenceCheck = await fetch(`${BASE_URL}/verifications/${sourceResult.verificationId}/evidence`, { headers: authHeaders });
  const sourceEvidenceData = await sourceEvidenceCheck.json();
  assert(sourceEvidenceCheck.status === 200 && sourceEvidenceData.success, 'HR can open exact official source evidence by ID');
  const srcEvidences = sourceEvidenceData.data.evidence || [];
  assert(srcEvidences.length > 0, `Official source verification produced ${srcEvidences.length} evidence artifact(s)`);
  assert(srcEvidences[0].sourceId === activeSource.sourceCode, 'Evidence record links to trusted source code');
  assert(srcEvidences[0].responseHash === sourceResult.responseHash, 'Evidence response hash matches cryptographic digest');
  console.log(`  Exact Verification and Evidence Package opened successfully for HR verifier!\n`);

  // ---------------------------------------------------------
  // Step 8: Pre-seeded Standard Identifiers Check (e.g. STAN-2024-8849)
  // ---------------------------------------------------------
  console.log('Step 8: Verify Official Source with Standard Seeded Academic Record (STAN-2024-8849)...');
  const stanRes = await fetch(`${BASE_URL}/verifications/verify-source`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sourceCode: activeSource.sourceCode,
      queryParams: {
        identifier: 'STAN-2024-8849'
      }
    })
  });
  const stanData = await stanRes.json();
  assert(stanRes.status === 200 && stanData.success, 'Standard academic credential verified by official source');
  assert(stanData.data.verified === true, 'STAN-2024-8849 verified as authentic');
  assert(stanData.data.sourceState === 'SOURCE_VERIFIED', 'STAN-2024-8849 has SOURCE_VERIFIED cryptographic status');
  console.log(`  STAN-2024-8849: Conferred to ${stanData.data.rawResponse?.record?.studentName} (${stanData.data.rawResponse?.record?.degreeAwarded})\n`);

  console.log('================================================================');
  console.log(`  PHASE 5 HR / VERIFIER WORKFLOW SUCCESS: ${passedAssertions}/${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

testPhase5Flow().catch((err) => {
  console.error('\n  Phase 5 test error:', err);
  process.exit(1);
});
