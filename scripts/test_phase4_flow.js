import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api';

async function testPhase4Flow() {
  console.log('================================================================');
  console.log('  SECUREWORK VERIFY - PHASE 4: ISSUER PERSONA WORKFLOW E2E TEST');
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

  // 1. Authenticate as ISSUER
  console.log('Step 1: Authenticate as Institutional Issuer (issuer_auth@stanford.edu)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'issuer_auth@stanford.edu',
      password: 'SecureUserPass123!'
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.success, 'Issuer login returns 200 OK');
  assert(loginData.data.user.role === 'ISSUER', 'Logged in user has ISSUER role');
  const token = loginData.data.token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log(`  Issuer Auth Token acquired for: ${loginData.data.user.name} (${loginData.data.user.email})\n`);

  // 2. Issuer Status
  console.log('Step 2: Inspect Issuer Status (Issuer Dashboard -> Issuer Status)...');
  const issuerListRes = await fetch(`${BASE_URL}/issuers?limit=100`, { headers: authHeaders });
  const issuerListData = await issuerListRes.json();
  assert(issuerListRes.status === 200 && issuerListData.success, 'Fetch issuers returns 200 OK');
  const issuers = issuerListData.data.issuers || [];
  assert(issuers.length > 0, 'Issuers exist in the system');
  const activeIssuer = issuers.find(i => i.status === 'ACTIVE' && (i.userId === loginData.data.user.userId || i.issuerCode === 'STANFORD_REGISTRAR'));
  assert(!!activeIssuer, 'Found Stanford University Registrar as ACTIVE accredited issuer');
  console.log(`  Active Issuer Profile: ${activeIssuer.issuerCode} (ID: ${activeIssuer.issuerId}, Status: ${activeIssuer.status})\n`);

  // 3. Key Status
  console.log('Step 3: Inspect Cryptographic Key Status (Key Status)...');
  const keyListRes = await fetch(`${BASE_URL}/issuer-keys?issuerId=${activeIssuer.issuerId}`, { headers: authHeaders });
  const keyListData = await keyListRes.json();
  assert(keyListRes.status === 200 && keyListData.success, 'Fetch issuer keys returns 200 OK');
  const keys = keyListData.data.keys || [];
  assert(keys.length > 0, 'Issuer has registered cryptographic keys');
  const activeKey = keys.find(k => k.status === 'ACTIVE');
  assert(!!activeKey, 'Issuer possesses an ACTIVE Ed25519 signing key');
  assert(activeKey.algorithm.toUpperCase() === 'ED25519', 'Key algorithm is Ed25519');
  console.log(`  Active Key ID: ${activeKey.keyId} (${activeKey.algorithm}, Status: ${activeKey.status})\n`);

  // 4. Holder Information & Document Artifact
  console.log('Step 4: Prepare Holder Information and Document Artifact...');
  // Dynamically resolve recipient holder user
  const scholarRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'scholar@stanford.edu', password: 'SecureUserPass123!' })
  });
  const scholarData = await scholarRes.json();
  assert(scholarRes.status === 200 && scholarData.success, 'Recipient holder resolved dynamically via user account');
  const recipientUser = scholarData.data.user;
  assert(!!recipientUser && recipientUser.userId.startsWith('usr_'), 'Valid recipient user ID acquired');
  console.log(`  Recipient Subject: ${recipientUser.name} (${recipientUser.email}, ID: ${recipientUser.userId})`);

  // Upload an authentic credential document to obtain real documentId
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const samplePdfPath = path.resolve(__dirname, '../backend/test/fixtures/sample_degree.pdf');
  let pdfBuffer;
  if (fs.existsSync(samplePdfPath)) {
    pdfBuffer = fs.readFileSync(samplePdfPath);
  } else {
    pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
  }

  const postBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Stanford_Degree_Phase4_${Date.now()}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBuffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nDEGREE\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await fetch(`${BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: postBody
  });
  const uploadData = await uploadRes.json();
  assert(uploadRes.status === 201 && uploadData.success, 'Document uploaded successfully with 201 Created');
  const documentId = uploadData.data.document.documentId;
  const documentSha256 = uploadData.data.document.sha256Hash;
  assert(!!documentId && documentId.startsWith('doc_'), 'Valid documentId received');
  assert(!!documentSha256 && documentSha256.length === 64, 'Valid SHA-256 hash calculated for document');
  console.log(`  Document Uploaded: ${documentId} (SHA-256: ${documentSha256})\n`);

  // 5. Backend Signing (Create / Issue Credential)
  console.log('Step 5: Backend Signing & Credential Issuance (POST /api/credentials/issue)...');
  const issuePayload = {
    issuerId: activeIssuer.issuerId,
    recipientId: recipientUser.userId,
    documentId: documentId,
    credentialType: 'DEGREE',
    title: `Master of Science in Distributed Cryptography (${Date.now()})`,
    validityDays: 730
  };

  const issueRes = await fetch(`${BASE_URL}/credentials/issue`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(issuePayload)
  });
  const issueData = await issueRes.json();
  assert(issueRes.status === 201 && issueData.success, 'Credential issuance returns 201 Created');
  const credential = issueData.data.credential;
  const version = issueData.data.version;

  // 6. Credential Created Validation
  console.log('Step 6: Validate Created Credential & Cryptographic Signature...');
  assert(!!credential.credentialId && credential.credentialId.startsWith('crd_'), 'Credential ID generated correctly');
  assert(version.documentId === documentId, 'Credential version links correctly to the uploaded documentId');
  assert(version.documentHash === documentSha256, 'Credential version stores authentic documentHash');
  assert(!!version.signature && version.signature.length > 50, 'Backend generated authentic Ed25519 digital signature');
  assert(version.issuerKeyId === activeKey.keyId, 'Signature generated using active issuer key');
  assert(!!version.signedPayload, 'Canonical signed payload returned');
  assert(version.signedPayload.documentHash === documentSha256, 'Canonical payload matches documentHash');
  console.log(`  Credential Created: ${credential.credentialId}`);
  console.log(`  Signature: ${version.signature.slice(0, 32)}...`);
  console.log(`  Signed Payload Canonical Hash: ${version.signedPayloadHash}\n`);

  // 7. Credential List Verification
  console.log('Step 7: Verify Issued Credential appears in Real Credential List...');
  const credListRes = await fetch(`${BASE_URL}/credentials?issuerId=${activeIssuer.issuerId}`, { headers: authHeaders });
  const credListData = await credListRes.json();
  assert(credListRes.status === 200 && credListData.success, 'Fetch credentials list returns 200 OK');
  const credentials = credListData.data.credentials || [];
  const foundCred = credentials.find(c => c.credentialId === credential.credentialId);
  assert(!!foundCred, 'Newly issued credential appears in institutional credential list');
  assert(foundCred.title === issuePayload.title, 'Credential list item title matches issued title');
  assert(foundCred.status === 'ACTIVE', 'Credential list item status is ACTIVE');

  // Verify single credential detail endpoint
  const singleCredRes = await fetch(`${BASE_URL}/credentials/${credential.credentialId}`, { headers: authHeaders });
  const singleCredData = await singleCredRes.json();
  assert(singleCredRes.status === 200 && singleCredData.success, 'Fetch single credential detail returns 200 OK');
  assert(singleCredData.data.credential.credentialId === credential.credentialId, 'Single credential endpoint returns exact credentialId');
  assert(!!singleCredData.data.currentVersion, 'Single credential endpoint returns current active version');

  // Verify versions endpoint
  const versionsRes = await fetch(`${BASE_URL}/credentials/${credential.credentialId}/versions`, { headers: authHeaders });
  const versionsData = await versionsRes.json();
  assert(versionsRes.status === 200 && versionsData.success, 'Fetch credential versions returns 200 OK');
  assert(versionsData.data.versions.length >= 1, 'Credential has at least 1 version record');
  console.log(`  Credential confirmed in registry with ${versionsData.data.versions.length} version(s)\n`);

  // 8. Verify Credential
  console.log('Step 8: Cryptographic Verification (Verify Credential)...');
  const verifyRes = await fetch(`${BASE_URL}/verifications/evaluate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      credentialId: credential.credentialId,
      documentHash: version.documentHash,
      documentId: version.documentId
    })
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200 && verifyData.success, 'Evaluation endpoint returns 200 OK');
  const evalResult = verifyData.data;
  console.log(`  Cryptographic Status: ${evalResult.cryptographicStatus}`);
  console.log(`  Final Result: ${evalResult.result}`);
  console.log(`  Trust Level: ${evalResult.trustLevel}`);
  console.log(`  Digital Signature: ${evalResult.checks?.digitalSignature?.details}`);
  console.log(`  Document Integrity: ${evalResult.checks?.documentIntegrity?.details}`);
  console.log(`  Issuer Authorization: ${evalResult.checks?.issuerAuthorization?.details}`);

  assert(evalResult.cryptographicStatus === 'PASSED', 'Cryptographic status is PASSED');
  assert(evalResult.result === 'VERIFIED', 'Verification result is VERIFIED');
  assert(evalResult.checks?.digitalSignature?.passed === true, 'Digital signature verified as valid by backend Ed25519 crypto');
  assert(evalResult.checks?.documentIntegrity?.passed === true, 'Document integrity verified as passed');
  assert(evalResult.checks?.issuerAuthorization?.passed === true, 'Issuer authorization verified as active');
  assert(evalResult.checks?.issuerKeyStatus?.passed === true, 'Issuer key verified as active');
  assert(evalResult.checks?.recipientBinding?.passed === true, 'Credential binding to recipient verified');
  assert(evalResult.trustLevel.includes('CURRENTLY_VALID'), 'Trust level indicates currently valid credential');
  assert(evalResult.evidence && evalResult.evidence.length > 0, 'Verification produced authentic evidence records');

  console.log('\n================================================================');
  console.log(`  PHASE 4 WORKFLOW SUCCESS: ${passedAssertions}/${totalAssertions} assertions passed!`);
  console.log('================================================================\n');
}

testPhase4Flow().catch((err) => {
  console.error('\n  Phase 4 test error:', err);
  process.exit(1);
});
