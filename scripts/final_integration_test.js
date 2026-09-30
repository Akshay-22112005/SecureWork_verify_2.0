import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api';

async function runFinalIntegrationTest() {
  console.log('======================================================================');
  console.log('  SECUREWORK VERIFY — FINAL COMPLETE INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

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

  // =========================================================================
  // WORKFLOW 1: GUEST (No Login -> Verify Credential -> Result)
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 1: GUEST WORKFLOW (Public Verification Without Login)');
  console.log('----------------------------------------------------------------------');

  // Step 1.1: Fetch a known seeded academic identifier without authentication
  console.log('Step 1.1: Public Query without Login (STAN-2024-8849)...');
  const guestSourceRes = await fetch(`${BASE_URL}/verifications/verify-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceCode: 'SRC_HE_REGISTRY_1790760161858',
      queryParams: { identifier: 'STAN-2024-8849' }
    })
  });
  const guestSourceData = await guestSourceRes.json();
  assert(guestSourceRes.status === 200 && guestSourceData.success, 'Guest can query official registry without auth');
  assert(guestSourceData.data.verified === true, 'STAN-2024-8849 verified for guest');
  assert(guestSourceData.data.sourceState === 'SOURCE_VERIFIED', 'Guest receives SOURCE_VERIFIED cryptographic status');

  // Step 1.2: Public Credential Evaluation by Hash / ID
  console.log('Step 1.2: Guest Credential Verification Evaluation...');
  const guestEvalRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialId: 'crd_3a63e23e0d33d8ad'
    })
  });
  const guestEvalData = await guestEvalRes.json();
  assert(guestEvalRes.status === 200 && guestEvalData.success, 'Guest evaluation returns 200 OK without JWT token');
  assert(guestEvalData.data.verificationId !== undefined, 'Verification ID generated for guest run');
  assert(guestEvalData.data.trustLevel !== undefined, `Trust level evaluated: ${guestEvalData.data.trustLevel}`);
  assert(Array.isArray(guestEvalData.data.checks) || typeof guestEvalData.data.checks === 'object', '16-Gate verification evidence returned');
  console.log(`  Guest Workflow Verified Successfully!\n`);

  // =========================================================================
  // WORKFLOW 2: USER / CREDENTIAL HOLDER
  // Login -> Dashboard -> Upload -> Analysis -> Credential -> Verify -> Evidence -> History
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 2: USER / CREDENTIAL HOLDER WORKFLOW');
  console.log('----------------------------------------------------------------------');

  // Step 2.1: Login as USER
  console.log('Step 2.1: Login as Credential Holder (scholar@stanford.edu)...');
  const userLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'scholar@stanford.edu', password: 'SecureUserPass123!' })
  });
  const userLoginData = await userLoginRes.json();
  assert(userLoginRes.status === 200 && userLoginData.success, 'User login returns 200 OK');
  assert(userLoginData.data.user.role === 'USER', 'Role is strictly USER');
  const userToken = userLoginData.data.token;
  const userHeaders = { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' };

  // Step 2.2: User Dashboard (Verify Profile)
  console.log('Step 2.2: Dashboard -> Fetch Current User Session (GET /api/auth/me)...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: userHeaders });
  const meData = await meRes.json();
  assert(meRes.status === 200 && meData.success, 'User session validates via GET /api/auth/me');
  assert(meData.data.user.email === 'scholar@stanford.edu', 'User profile email matches');

  // Step 2.3: Upload Document
  console.log('Step 2.3: Upload -> Ingest Document (POST /api/documents/upload)...');
  const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (User Test Degree) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Holder_Degree_${Date.now()}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    dummyPdfContent,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="representationType"\r\n\r\nORIGINAL_DIGITAL_FILE\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await fetch(`${BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: multipartBody
  });
  const uploadData = await uploadRes.json();
  assert(uploadRes.status === 201 && uploadData.success, 'Document upload returns 201 Created');
  const uploadedDoc = uploadData.data.document;
  assert(!!uploadedDoc.documentId, `Document ID assigned: ${uploadedDoc.documentId}`);
  assert(!!uploadedDoc.sha256Hash && uploadedDoc.sha256Hash.length === 64, `Authoritative SHA-256 computed: ${uploadedDoc.sha256Hash}`);

  // Step 2.4: Analysis (OCR & AI)
  console.log('Step 2.4: Analysis -> Run OCR and Advisory AI Inspection...');
  const ocrRes = await fetch(`${BASE_URL}/analysis/ocr`, {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ documentId: uploadedDoc.documentId })
  });
  const ocrData = await ocrRes.json();
  assert(ocrRes.status === 200 && ocrData.success, 'OCR engine processed uploaded document');

  const aiRes = await fetch(`${BASE_URL}/analysis/document`, {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({ documentId: uploadedDoc.documentId })
  });
  const aiData = await aiRes.json();
  assert(aiRes.status === 200 && aiData.success, 'AI tampering heuristics completed');

  // Step 2.5: Credential Portfolio
  console.log('Step 2.5: My Credentials -> Load User Credentials Portfolio...');
  const userCredsRes = await fetch(`${BASE_URL}/credentials`, { headers: userHeaders });
  const userCredsData = await userCredsRes.json();
  assert(userCredsRes.status === 200 && userCredsData.success, 'User credentials portfolio loaded');
  const portfolio = userCredsData.data.credentials || [];
  assert(portfolio.length > 0, `Portfolio contains ${portfolio.length} credential(s)`);
  const userCred = portfolio[0];

  // Step 2.6: Verify Credential
  console.log('Step 2.6: Verify -> Evaluate Credential (POST /api/verifications/evaluate)...');
  const userVerifRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      credentialId: userCred.credentialId,
      documentHash: userCred.documentHash
    })
  });
  const userVerifData = await userVerifRes.json();
  assert(userVerifRes.status === 200 && userVerifData.success, 'Verification evaluation returns 200 OK');
  const evaluatedVerif = userVerifData.data;
  assert(evaluatedVerif.result === 'VERIFIED', 'Credential verified as authentic');

  // Step 2.7: Evidence Inspection
  console.log('Step 2.7: Evidence -> Inspect Evidence Package...');
  const userEviRes = await fetch(`${BASE_URL}/verifications/${evaluatedVerif.verificationId}/evidence`, { headers: userHeaders });
  const userEviData = await userEviRes.json();
  assert(userEviRes.status === 200 && userEviData.success, 'Evidence package retrieved');
  assert((userEviData.data.evidence || []).length > 0, 'Evidence records present');

  // Step 2.8: History
  console.log('Step 2.8: History -> Verification History Inspection...');
  const userHistRes = await fetch(`${BASE_URL}/verifications`, { headers: userHeaders });
  const userHistData = await userHistRes.json();
  assert(userHistRes.status === 200 && userHistData.success, 'Verification history logs retrieved');
  console.log(`  User Workflow Verified Successfully!\n`);

  // =========================================================================
  // WORKFLOW 3: ISSUER
  // Login -> Issuer -> Create Credential -> Sign -> Issue -> Verify
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 3: ISSUER WORKFLOW');
  console.log('----------------------------------------------------------------------');

  // Step 3.1: Login as ISSUER
  console.log('Step 3.1: Login as Institutional Issuer (issuer_auth@stanford.edu)...');
  const issuerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'issuer_auth@stanford.edu', password: 'SecureUserPass123!' })
  });
  const issuerLoginData = await issuerLoginRes.json();
  assert(issuerLoginRes.status === 200 && issuerLoginData.success, 'Issuer login returns 200 OK');
  const issuerToken = issuerLoginData.data.token;
  const issuerUser = issuerLoginData.data.user;
  const issuerHeaders = { 'Authorization': `Bearer ${issuerToken}`, 'Content-Type': 'application/json' };

  // Step 3.2: Ingest Master Degree PDF as Issuer
  console.log('Step 3.2: Ingest Master Degree PDF as Issuer...');
  const issuerDocBoundary = `----WebKitFormBoundaryIssuer${Date.now()}`;
  const issuerDocBody = Buffer.concat([
    Buffer.from(`--${issuerDocBoundary}\r\nContent-Disposition: form-data; name="file"; filename="Stanford_Degree_Final_${Date.now()}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    dummyPdfContent,
    Buffer.from(`\r\n--${issuerDocBoundary}\r\nContent-Disposition: form-data; name="representationType"\r\n\r\nORIGINAL_DIGITAL_FILE\r\n--${issuerDocBoundary}--\r\n`)
  ]);

  const issuerUploadRes = await fetch(`${BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${issuerToken}`,
      'Content-Type': `multipart/form-data; boundary=${issuerDocBoundary}`
    },
    body: issuerDocBody
  });
  const issuerUploadData = await issuerUploadRes.json();
  assert(issuerUploadRes.status === 201 && issuerUploadData.success, 'Issuer uploaded master document');
  const issuerDocId = issuerUploadData.data.document.documentId;

  // Step 3.3: Resolve Active Issuer Profile & Signing Keys for This Issuer User
  console.log('Step 3.3: Resolve Active Issuer Profile & Signing Keys...');
  const issuerListRes = await fetch(`${BASE_URL}/issuers?limit=100`, { headers: issuerHeaders });
  const issuerListData = await issuerListRes.json();
  assert(issuerListRes.status === 200 && issuerListData.success, 'Issuers list retrieved');
  const allIssuers = issuerListData.data.issuers || [];
  const activeIssuer = allIssuers.find(i => i.userId === issuerUser.userId && i.status === 'ACTIVE') ||
                       allIssuers.find(i => i.issuerCode === 'STANFORD_REGISTRAR') ||
                       allIssuers.find(i => i.status === 'ACTIVE');
  assert(!!activeIssuer, `Active accredited issuer located: ${activeIssuer?.issuerCode}`);

  const keysRes = await fetch(`${BASE_URL}/issuer-keys?issuerId=${activeIssuer.issuerId}`, { headers: issuerHeaders });
  const keysData = await keysRes.json();
  assert(keysRes.status === 200 && keysData.success, 'Issuer keys retrieved');
  const activeKey = (keysData.data.keys || []).find(k => k.status === 'ACTIVE');
  assert(!!activeKey, `Active Ed25519 key located: ${activeKey?.keyId} (${activeKey?.algorithm})`);

  // Step 3.4: Canonical Sign & Issue Verifiable Credential
  console.log('Step 3.4: Canonical Sign & Issue Verifiable Credential...');
  const issueRes = await fetch(`${BASE_URL}/credentials/issue`, {
    method: 'POST',
    headers: issuerHeaders,
    body: JSON.stringify({
      issuerId: activeIssuer.issuerId,
      recipientId: userLoginData.data.user.userId,
      documentId: issuerDocId,
      credentialType: 'DEGREE',
      title: `Executive Master of Science in Cyber Defense (${Date.now()})`,
      validityDays: 730
    })
  });
  const issueData = await issueRes.json();
  assert(issueRes.status === 201 && issueData.success, 'Credential created & Ed25519 signed with 201 Created');
  const newlyIssuedCred = issueData.data.credential;
  const newlyIssuedVersion = issueData.data.version || newlyIssuedCred.currentVersion;
  assert(!!newlyIssuedCred.credentialId, `Issued Credential ID: ${newlyIssuedCred.credentialId}`);
  assert(!!newlyIssuedVersion?.signature, `Ed25519 Signature generated: ${newlyIssuedVersion?.signature?.substring(0, 24)}...`);

  // Step 3.5: Verify newly issued credential
  console.log('Step 3.5: Verify Newly Issued Credential...');
  const newlyIssuedVerifRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: issuerHeaders,
    body: JSON.stringify({
      credentialId: newlyIssuedCred.credentialId,
      documentHash: newlyIssuedVersion?.documentHash
    })
  });
  const newlyIssuedVerifData = await newlyIssuedVerifRes.json();
  assert(newlyIssuedVerifRes.status === 200 && newlyIssuedVerifData.success, 'Newly issued credential verified');
  assert(newlyIssuedVerifData.data.result === 'VERIFIED', 'Newly issued credential is mathematically VERIFIED');
  console.log(`  Issuer Workflow Verified Successfully!\n`);

  // =========================================================================
  // WORKFLOW 4: HR / VERIFIER
  // Login -> HR -> Verify -> Evidence -> Logs
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 4: HR / VERIFIER WORKFLOW');
  console.log('----------------------------------------------------------------------');

  // Step 4.1: Login as HR
  console.log('Step 4.1: Login as HR Verifier (hr_lead@enterprise.local)...');
  const hrLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr_lead@enterprise.local', password: 'SecureUserPass123!' })
  });
  const hrLoginData = await hrLoginRes.json();
  assert(hrLoginRes.status === 200 && hrLoginData.success, 'HR login returns 200 OK');
  const hrToken = hrLoginData.data.token;
  const hrHeaders = { 'Authorization': `Bearer ${hrToken}`, 'Content-Type': 'application/json' };

  // Step 4.2: HR Verify Candidate Qualification
  console.log('Step 4.2: HR Evaluates Candidate Qualification Verification...');
  const hrVerifRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: hrHeaders,
    body: JSON.stringify({
      credentialId: newlyIssuedCred.credentialId,
      documentHash: newlyIssuedVersion?.documentHash
    })
  });
  const hrVerifData = await hrVerifRes.json();
  assert(hrVerifRes.status === 200 && hrVerifData.success, 'HR verification returns 200 OK');
  const hrVerifId = hrVerifData.data.verificationId;
  assert(!!hrVerifId, `HR Verification ID: ${hrVerifId}`);

  // Step 4.3: HR Inspects Discrete Evidence Artifacts
  console.log('Step 4.3: HR Inspects Discrete Evidence Package...');
  const hrEviRes = await fetch(`${BASE_URL}/verifications/${hrVerifId}/evidence`, { headers: hrHeaders });
  const hrEviData = await hrEviRes.json();
  assert(hrEviRes.status === 200 && hrEviData.success, 'HR evidence package loaded');
  assert((hrEviData.data.evidence || []).length > 0, `HR inspected ${(hrEviData.data.evidence || []).length} evidence items`);

  // Step 4.4: HR Submits Authoritative Manual Review Log
  console.log('Step 4.4: HR Submits Authoritative Review Log & Updates Verification Status...');
  const hrReviewRes = await fetch(`${BASE_URL}/verifications/${hrVerifId}/manual-review`, {
    method: 'POST',
    headers: hrHeaders,
    body: JSON.stringify({
      decision: 'CONFIRMED',
      reviewNotes: 'Executive HR talent background review confirmed genuine'
    })
  });
  const hrReviewData = await hrReviewRes.json();
  assert(hrReviewRes.status === 200 && hrReviewData.success, 'HR review submitted and hash-chained');
  assert(hrReviewData.data.verification.humanVerificationStatus === 'CONFIRMED', 'Human verification status updated to CONFIRMED');
  assert(hrReviewData.data.verification.finalResult === 'MANUALLY_VERIFIED' || hrReviewData.data.verification.result === 'VERIFIED', 'Verification status updated after human confirmation');
  console.log(`  HR Workflow Verified Successfully!\n`);

  // =========================================================================
  // WORKFLOW 5: AUDITOR
  // Login -> Auditor -> Audit Logs -> Evidence -> Hash Chain
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 5: AUDITOR & COMPLIANCE WORKFLOW');
  console.log('----------------------------------------------------------------------');

  // Step 5.1: Login as AUDITOR
  console.log('Step 5.1: Login as Compliance Auditor (auditor@securework.local)...');
  const auditorLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'auditor@securework.local', password: 'AdminSecurePass123!' })
  });
  const auditorLoginData = await auditorLoginRes.json();
  assert(auditorLoginRes.status === 200 && auditorLoginData.success, 'Auditor login returns 200 OK');
  const auditorToken = auditorLoginData.data.token;
  const auditorHeaders = { 'Authorization': `Bearer ${auditorToken}`, 'Content-Type': 'application/json' };

  // Step 5.2: Auditor Inspects Immutable Append-Only Audit Logs
  console.log('Step 5.2: Auditor Queries Cryptographic Audit Ledger Stream...');
  const auditLogsRes = await fetch(`${BASE_URL}/audit-logs?limit=25`, { headers: auditorHeaders });
  const auditLogsData = await auditLogsRes.json();
  assert(auditLogsRes.status === 200 && auditLogsData.success, 'Auditor retrieved audit logs');
  assert((auditLogsData.data.logs || []).length > 0, `Audit logs stream contains ${(auditLogsData.data.logs || []).length} records`);

  // Step 5.3: Auditor Inspects Evidence
  console.log('Step 5.3: Auditor Inspects Cryptographic Verification Evidence Packages...');
  const auditorEviRes = await fetch(`${BASE_URL}/verifications/${hrVerifId}/evidence`, { headers: auditorHeaders });
  const auditorEviData = await auditorEviRes.json();
  assert(auditorEviRes.status === 200 && auditorEviData.success, 'Auditor retrieved evidence package');

  // Step 5.4: Auditor Validates Hash Chain Integrity & Anchors Checkpoint
  console.log('Step 5.4: Auditor Validates Full Genesis-to-Head Hash Chain...');
  const chainValRes = await fetch(`${BASE_URL}/audit-logs/validate`, { headers: auditorHeaders });
  const chainValData = await chainValRes.json();
  assert(chainValRes.status === 200 && chainValData.success, 'Chain validation returns 200 OK');
  assert(chainValData.data.validation.valid === true, 'Complete audit log hash chain is mathematically valid');
  assert((chainValData.data.validation.errors || []).length === 0, 'Zero tampering across audit chain');
  console.log(`  Auditor Workflow Verified Successfully!\n`);

  // =========================================================================
  // WORKFLOW 6: ADMIN
  // Login -> Admin -> Users -> Organizations -> Issuers -> Trusted Sources -> System Health
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 6: SYSTEM ADMINISTRATOR WORKFLOW');
  console.log('----------------------------------------------------------------------');

  // Step 6.1: Login as ADMIN
  console.log('Step 6.1: Login as System Administrator (admin@securework.local)...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@securework.local', password: 'AdminSecurePass123!' })
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.status === 200 && adminLoginData.success, 'Admin login returns 200 OK');
  const adminToken = adminLoginData.data.token;
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  // Step 6.2: Admin User Directory
  console.log('Step 6.2: Admin Users Directory (GET /api/users)...');
  const usersRes = await fetch(`${BASE_URL}/users`, { headers: adminHeaders });
  const usersData = await usersRes.json();
  assert(usersRes.status === 200 && usersData.success, 'Admin can list platform users directory');
  assert((usersData.data.users || []).length > 0, `Users directory has ${(usersData.data.users || []).length} registered users`);

  // Step 6.3: Admin Organizations Accreditation
  console.log('Step 6.3: Admin Organizations Accreditation (GET /api/organizations)...');
  const orgsRes = await fetch(`${BASE_URL}/organizations`, { headers: adminHeaders });
  const orgsData = await orgsRes.json();
  assert(orgsRes.status === 200 && orgsData.success, 'Admin can list organizations');
  assert((orgsData.data.organizations || []).length > 0, `Organizations registry has ${(orgsData.data.organizations || []).length} organizations`);

  // Step 6.4: Admin Issuers Review
  console.log('Step 6.4: Admin Issuers Directory (GET /api/issuers)...');
  const adminIssuersRes = await fetch(`${BASE_URL}/issuers`, { headers: adminHeaders });
  const adminIssuersData = await adminIssuersRes.json();
  assert(adminIssuersRes.status === 200 && adminIssuersData.success, 'Admin can list institutional issuers');

  // Step 6.5: Admin Trusted Sources
  console.log('Step 6.5: Admin Trusted Sources Whitelist (GET /api/trusted-sources)...');
  const adminSourcesRes = await fetch(`${BASE_URL}/trusted-sources`, { headers: adminHeaders });
  const adminSourcesData = await adminSourcesRes.json();
  assert(adminSourcesRes.status === 200 && adminSourcesData.success, 'Admin can list trusted source registry');

  // Step 6.6: Admin System Health
  console.log('Step 6.6: Admin System Health Check (GET /api/health)...');
  const healthRes = await fetch(`${BASE_URL}/health`, { headers: adminHeaders });
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.success, 'System health endpoint returns healthy state');
  assert(healthData.data.status === 'healthy', 'Backend service status is healthy');
  console.log(`  Admin Workflow Verified Successfully!\n`);

  // =========================================================================
  // WORKFLOW 7: NEGATIVE & EDGE CASE TESTS
  // Logout, Refresh, Unauthorized Access, Invalid/Tampered/Revoked Credentials, API Errors
  // =========================================================================
  console.log('----------------------------------------------------------------------');
  console.log('WORKFLOW 7: NEGATIVE & EDGE CASE VALIDATIONS');
  console.log('----------------------------------------------------------------------');

  // 7.1: Logout / Invalid Token Rejection
  console.log('Step 7.1: Token Invalidation / Protected Route Unauthorized Access...');
  const fakeTokenRes = await fetch(`${BASE_URL}/audit-logs`, {
    headers: { 'Authorization': 'Bearer fake_invalid_jwt_token_12345' }
  });
  assert(fakeTokenRes.status === 401, 'Invalid/expired token returns 401 Unauthorized');

  // 7.2: Unauthorized Role Access (RBAC Gate)
  console.log('Step 7.2: RBAC Gate -> Standard USER blocked from Admin Users Directory...');
  const rbacRes = await fetch(`${BASE_URL}/users`, { headers: userHeaders });
  assert(rbacRes.status === 403, 'Standard user blocked with 403 Forbidden on /api/users');

  // 7.3: Invalid Credential Query
  console.log('Step 7.3: Non-Existent Credential ID Evaluation...');
  const notFoundRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId: 'crd_non_existent_id_99999999' })
  });
  const notFoundData = await notFoundRes.json();
  assert(notFoundRes.status === 200, 'Non-existent credential query handled gracefully by evaluation pipeline');
  assert(notFoundData.data.result === 'NOT_FOUND', 'Result marked as NOT_FOUND');
  assert(notFoundData.data.trustLevel === 'LEVEL 0 UNKNOWN', 'Trust level assigned as LEVEL 0 UNKNOWN');

  // 7.4: Tampered Document / Bit Modification (Tamper Detection)
  console.log('Step 7.4: Modified File / Tampered Document Hash Evaluation...');
  const tamperedHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const tamperedRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialId: newlyIssuedCred.credentialId,
      documentHash: tamperedHash
    })
  });
  const tamperedData = await tamperedRes.json();
  assert(tamperedRes.status === 200, 'Tampered evaluation handled gracefully by evaluation pipeline');
  assert(tamperedData.data.result === 'ALTERED', 'Verification Engine correctly flags document as ALTERED');
  assert(tamperedData.data.cryptographicStatus === 'FAILED' || tamperedData.data.checks?.documentIntegrity?.passed === false, 'Document integrity fails cryptographic check');

  // 7.5: Revoked Credential Handling
  console.log('Step 7.5: Credential Revocation & Revoked Status Evaluation...');
  const revokeRes = await fetch(`${BASE_URL}/credentials/${newlyIssuedCred.credentialId}/revoke`, {
    method: 'PATCH',
    headers: issuerHeaders,
    body: JSON.stringify({ reason: 'Integration test intentional revocation' })
  });
  const revokeData = await revokeRes.json();
  assert(revokeRes.status === 200 && revokeData.success, 'Credential revoked successfully');

  const revokedEvalRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialId: newlyIssuedCred.credentialId,
      documentHash: newlyIssuedVersion?.documentHash
    })
  });
  const revokedEvalData = await revokedEvalRes.json();
  assert(revokedEvalRes.status === 200, 'Revoked credential evaluated without crashing');
  assert(revokedEvalData.data.result === 'CREDENTIAL_REVOKED', 'Verification Engine flags status as CREDENTIAL_REVOKED');
  assert(revokedEvalData.data.trustLevel === 'LEVEL 4 SIGNATURE_VERIFIED', 'Digital signature remains historically valid (Level 4)');

  // 7.6: API Error Handling on Malformed Input
  console.log('Step 7.6: Malformed Input Graceful Error Handling...');
  const malformedRes = await fetch(`${BASE_URL}/credentials/issue`, {
    method: 'POST',
    headers: issuerHeaders,
    body: JSON.stringify({ missingRequiredFields: true })
  });
  assert(malformedRes.status === 400, 'Malformed credential issuance returns 400 Bad Request with validation error');

  console.log('\n======================================================================');
  console.log(`  FINAL INTEGRATION TEST RESULTS: ALL ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED!`);
  console.log('======================================================================\n');
}

runFinalIntegrationTest().catch((err) => {
  console.error('\n  Final Integration Test Error:', err);
  process.exit(1);
});
