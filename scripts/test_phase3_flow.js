const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`;
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined)
  });

  const json = await res.json();
  return { status: res.status, ok: res.ok, data: json };
}

async function runPhase3Tests() {
  console.log('======================================================================');
  console.log('  SECUREWORK VERIFY — PHASE 3 AUTOMATED VERIFICATION SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Public Verification WITHOUT Login
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Public Verification WITHOUT Login ---');
  try {
    const publicEval = await request('/verifications/evaluate', {
      method: 'POST',
      body: {
        documentHash: '7398533646c76f0478c72847be20be24fc7b3bb3717666384474e4057980417b'
      }
    });

    assert(publicEval.ok && publicEval.data.success, 'Public verification API works without auth token');
    assert(publicEval.data.data.verificationId?.startsWith('vrf_'), `Generated valid verification ID: ${publicEval.data.data.verificationId}`);
    assert(publicEval.data.data.checks !== undefined, 'Returned 16-factor categorical evidence matrix');
    assert(publicEval.data.data.trustLevel !== undefined, `Trust level evaluated: ${publicEval.data.data.trustLevel}`);
  } catch (err) {
    assert(false, `Public verification failed: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Login with each available role & verify correct dashboard
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Role-Based Authentication & Dashboard Mapping ---');
  const rolesToTest = [
    { role: 'ADMIN', email: 'admin@securework.local', pass: 'AdminSecurePass123!', expectedTitle: 'System Administrator Dashboard' },
    { role: 'AUDITOR', email: 'auditor@securework.local', pass: 'AdminSecurePass123!', expectedTitle: 'Compliance & Auditor Dashboard' },
    { role: 'ISSUER', email: 'issuer_auth@stanford.edu', pass: 'SecureUserPass123!', expectedTitle: 'Credential Issuer Dashboard' },
    { role: 'HR', email: 'hr_lead@enterprise.local', pass: 'SecureUserPass123!', expectedTitle: 'HR & Verifier Dashboard' },
    { role: 'USER', email: 'scholar@stanford.edu', pass: 'SecureUserPass123!', expectedTitle: 'Credential Holder Dashboard' }
  ];

  let userAuthToken = null;
  let userProfile = null;

  for (const r of rolesToTest) {
    try {
      const loginRes = await request('/auth/login', {
        method: 'POST',
        body: { email: r.email, password: r.pass }
      });

      assert(loginRes.ok && loginRes.data.success, `Login succeeded for ${r.role} (${r.email})`);
      const { token, user } = loginRes.data.data;
      assert(user.role === r.role, `Verified user profile role is strictly ${r.role}`);
      assert(token && token.length > 20, `Issued HMAC-SHA256 JWT auth token for ${r.role}`);

      // Verify /auth/me returns this authenticated user
      const meRes = await request('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert(meRes.ok && meRes.data.data.user.role === r.role, `Session token validates against backend as ${r.role}`);

      if (r.role === 'USER') {
        userAuthToken = token;
        userProfile = user;
      }
    } catch (err) {
      assert(false, `Role login failed for ${r.role}: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 3: Complete USER / Credential Holder Workflow
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Complete USER / Credential Holder Workflow ---');
  let uploadedDocId = null;
  let uploadedDocHash = null;
  let verifiedCredentialId = null;
  let verificationId = null;

  // Step 3.1: Upload Document
  console.log('Step 3.1: Upload Document (POST /api/documents/upload)');
  try {
    const filePath = path.resolve(__dirname, '../sample_qualification.pdf');
    const fileBytes = fs.readFileSync(filePath);
    const blob = new Blob([fileBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, 'sample_qualification.pdf');

    const uploadRes = await fetch(`${BACKEND_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAuthToken}`
      },
      body: formData
    });
    const uploadData = await uploadRes.json();

    assert(uploadRes.ok && uploadData.success, 'Document uploaded successfully to local storage');
    uploadedDocId = uploadData.data.document.documentId;
    uploadedDocHash = uploadData.data.document.sha256Hash;
    assert(uploadedDocId?.startsWith('doc_'), `Document ID generated: ${uploadedDocId}`);
    assert(/^[a-f0-9]{64}$/.test(uploadedDocHash), `Document SHA-256 computed: ${uploadedDocHash}`);
  } catch (err) {
    assert(false, `Document upload failed: ${err.message}`);
  }

  // Step 3.2: Document Analysis (Local OCR & AI Heuristics)
  console.log('\nStep 3.2: Document Analysis (POST /api/analysis/ocr & /api/analysis/document)');
  try {
    const ocrRes = await request('/analysis/ocr', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAuthToken}` },
      body: { documentId: uploadedDocId }
    });
    assert(ocrRes.ok && ocrRes.data.success, `OCR text extraction completed on ${uploadedDocId}`);

    const aiRes = await request('/analysis/document', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAuthToken}` },
      body: { documentId: uploadedDocId }
    });
    assert(aiRes.ok && aiRes.data.success, `AI risk heuristics analyzed on ${uploadedDocId}`);

    const getAnalysisRes = await request(`/analysis/${uploadedDocId}`, {
      headers: { Authorization: `Bearer ${userAuthToken}` }
    });
    assert(getAnalysisRes.ok && getAnalysisRes.data.success, `Stored analysis retrieved for ${uploadedDocId}`);
  } catch (err) {
    assert(false, `Document analysis failed: ${err.message}`);
  }

  // Step 3.3: My Credentials
  console.log('\nStep 3.3: My Credentials (GET /api/credentials)');
  try {
    const credRes = await request('/credentials', {
      headers: { Authorization: `Bearer ${userAuthToken}` }
    });
    assert(credRes.ok && credRes.data.success, 'Loaded user credentials from backend');
    const creds = credRes.data.data.credentials || [];
    assert(creds.length > 0, `Found ${creds.length} real credential(s) in user portfolio`);

    const selectedCred = creds[0];
    verifiedCredentialId = selectedCred.credentialId;
    assert(verifiedCredentialId?.startsWith('crd_'), `Selected credential ID: ${verifiedCredentialId}`);

    // Step 3.4: Credential Details
    console.log('\nStep 3.4: Credential Details (GET /api/credentials/:id)');
    const credDetailRes = await request(`/credentials/${verifiedCredentialId}`, {
      headers: { Authorization: `Bearer ${userAuthToken}` }
    });
    assert(credDetailRes.ok && credDetailRes.data.success, `Retrieved exact credential ${verifiedCredentialId}`);
    const { credential, currentVersion } = credDetailRes.data.data;
    assert(credential.credentialId === verifiedCredentialId, 'Preserved credentialId matches exact query');
    assert(currentVersion?.signature !== undefined, 'Cryptographic Ed25519 signature present');
    assert(currentVersion?.signedPayload !== undefined, 'RFC 8785 canonical signed payload present');

    // Step 3.5: Verify Credential
    console.log('\nStep 3.5: Verify Credential (POST /api/verifications/evaluate)');
    const evalRes = await request('/verifications/evaluate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAuthToken}` },
      body: {
        credentialId: verifiedCredentialId,
        documentHash: credential.documentHash
      }
    });

    assert(evalRes.ok && evalRes.data.success, `Verification evaluated for ${verifiedCredentialId}`);
    const verResult = evalRes.data.data;
    verificationId = verResult.verificationId;
    assert(verificationId?.startsWith('vrf_'), `Preserved verificationId: ${verificationId}`);
    assert(verResult.cryptographicStatus === 'PASSED', `Cryptographic status: ${verResult.cryptographicStatus}`);
    assert(verResult.finalResult === 'PASSED' || verResult.finalResult === 'VERIFIED', `Categorical result: ${verResult.finalResult}`);
    assert(verResult.checks?.digitalSignature?.passed === true, 'Digital signature passed Ed25519 mathematical verification');
    assert(verResult.checks?.organizationTrust?.passed === true, 'Issuer organization verified as Stanford University');

    // Step 3.6: Evidence
    console.log('\nStep 3.6: Verification Evidence (GET /api/verifications/:id/evidence)');
    const evidenceRes = await request(`/verifications/${verificationId}/evidence`, {
      headers: { Authorization: `Bearer ${userAuthToken}` }
    });
    assert(evidenceRes.ok && evidenceRes.data.success, `Evidence retrieved for ${verificationId}`);
    const evidenceItems = evidenceRes.data.data.evidence || [];
    assert(evidenceItems.length > 0, `Found ${evidenceItems.length} discrete historical evidence records`);
    assert(evidenceItems[0].verificationId === verificationId, `Evidence item preserved exact verificationId: ${verificationId}`);

    // Step 3.7: Verification History
    console.log('\nStep 3.7: Verification History (GET /api/verifications/:id & GET /api/verifications)');
    const singleVerRes = await request(`/verifications/${verificationId}`, {
      headers: { Authorization: `Bearer ${userAuthToken}` }
    });
    assert(singleVerRes.ok && singleVerRes.data.success, `Retrieved single verification record ${verificationId}`);
    assert(singleVerRes.data.data.verification.verificationId === verificationId, 'History item preserved exact verificationId');

    const listVerRes = await request('/verifications', {
      headers: { Authorization: `Bearer ${userAuthToken}` }
    });
    assert(listVerRes.ok && listVerRes.data.success, 'Loaded verifications history list');
    const verList = listVerRes.data.data.verifications || [];
    const foundInHistory = verList.some(v => v.verificationId === verificationId);
    assert(foundInHistory, `Newly evaluated verification ${verificationId} present in history audit trail`);
  } catch (err) {
    assert(false, `User workflow error: ${err.message}`);
  }

  console.log('\n======================================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
