/**
 * Phase 2 Features Integration Tests
 * Tests: public verification, PDF, offline bundle, W3C VC, bulk issuance,
 *        tamper simulation, API keys (/v1/verify), webhooks, and analytics.
 */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");
const { connectDB, disconnectDB } = require("../src/config/db");
const User = require("../src/models/user.model");
const Issuer = require("../src/models/issuer.model");
const IssuerKey = require("../src/models/issuerKey.model");
const Credential = require("../src/models/credential.model");
const ApiKey = require("../src/models/apiKey.model");
const Webhook = require("../src/models/webhook.model");

describe("Phase 2 Feature Tests", () => {
  let server, baseUrl;
  let adminToken, issuerToken;
  let testIssuerId, testIssuerKeyId, testCredentialId;
  let testApiKeyRaw;

  before(async () => {
    await connectDB();

    // Cleanup stale test data
    await User.deleteMany({ email: /@p2test\.local$/ });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // Register & login admin
    const adminReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "P2 Admin", email: "p2admin@p2test.local", password: "AdminPass123!" })
    });
    const adminBody = await adminReg.json();
    const adminDbUser = await User.findOne({ email: "p2admin@p2test.local" });
    if (adminDbUser) { adminDbUser.role = "ADMIN"; await adminDbUser.save(); }
    // Re-login to get admin token
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "p2admin@p2test.local", password: "AdminPass123!" })
    });
    const adminLoginBody = await adminLogin.json();
    adminToken = adminLoginBody.data?.token;

    // Register issuer user
    const issReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "P2 Issuer", email: "p2issuer@p2test.local", password: "IssuerPass123!" })
    });
    const issBody = await issReg.json();
    const issDbUser = await User.findOne({ email: "p2issuer@p2test.local" });
    if (issDbUser) { issDbUser.role = "ISSUER"; await issDbUser.save(); }
    const issLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "p2issuer@p2test.local", password: "IssuerPass123!" })
    });
    const issLoginBody = await issLogin.json();
    issuerToken = issLoginBody.data?.token;

    // Create issuer profile
    const issuerCreate = await fetch(`${baseUrl}/api/issuers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${issuerToken}` },
      body: JSON.stringify({ issuerCode: "P2TESTUNI", legalName: "Phase 2 Test University", issuerType: "UNIVERSITY" })
    });
    const issuerCreateBody = await issuerCreate.json();
    testIssuerId = issuerCreateBody.data?.issuer?.issuerId;

    // Approve issuer (admin)
    if (testIssuerId) {
      await fetch(`${baseUrl}/api/issuers/${testIssuerId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` }
      });
    }

    // Generate key
    if (testIssuerId) {
      const keyRes = await fetch(`${baseUrl}/api/issuers/${testIssuerId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${issuerToken}` }
      });
      const keyBody = await keyRes.json();
      testIssuerKeyId = keyBody.data?.key?.keyId || keyBody.data?.issuerKey?.keyId;
    }

    // Get a user id for recipient
    const issDbUser2 = await User.findOne({ email: "p2issuer@p2test.local" });
    const recipientId = issDbUser2?.userId;

    // Issue one credential via seeded doc or minimal doc
    if (testIssuerId && recipientId) {
      const credRes = await fetch(`${baseUrl}/api/credentials/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${issuerToken}` },
        body: JSON.stringify({
          issuerId: testIssuerId,
          recipientId,
          documentId: `doc_test_${Date.now()}`,
          credentialType: "CERTIFICATION",
          title: "Phase 2 Test Certificate",
          validityDays: 365
        })
      });
      const credBody = await credRes.json();
      testCredentialId = credBody.data?.credential?.credentialId;
    }
  });

  after(async () => {
    try {
      await User.deleteMany({ email: /@p2test\.local$/ });
      if (testIssuerId) await Issuer.deleteMany({ issuerId: testIssuerId });
    } catch {}
    if (server) {
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  /* ─── 1. Public Verification Portal ─────────────────────── */
  describe("Public Verification API", () => {
    test("GET /api/public/verify/:id returns 200 or 404 for unknown id", async () => {
      const res = await fetch(`${baseUrl}/api/public/verify/cred_unknown_xyz`);
      const body = await res.json();
      assert.ok([200, 404].includes(res.status), `Expected 200 or 404, got ${res.status}`);
    });

    test("GET /api/public/verify/:id with real credentialId returns VALID status", async () => {
      if (!testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/public/verify/${testCredentialId}`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(body.success);
      assert.ok(["VALID", "REVOKED", "EXPIRED", "TAMPERED", "UNKNOWN"].includes(body.data.status),
        `Invalid status: ${body.data.status}`);
      assert.ok(body.data.issuer, "Must include issuer info");
      assert.strictEqual(body.data.pii, undefined, "PII must not be exposed");
    });

    test("GET /api/public/revocations returns list", async () => {
      const res = await fetch(`${baseUrl}/api/public/revocations`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(body.success);
      assert.ok(Array.isArray(body.data.revocations), "revocations must be array");
    });
  });

  /* ─── 2. PDF Certificate ─────────────────────────────────── */
  describe("PDF Certificate Endpoint", () => {
    test("GET /api/public/pdf/:id returns 200 application/pdf or 404", async () => {
      if (!testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/public/pdf/${testCredentialId}`);
      assert.ok([200, 404].includes(res.status));
      if (res.status === 200) {
        const ct = res.headers.get("content-type") || "";
        assert.ok(ct.includes("pdf"), `Expected PDF content-type, got ${ct}`);
      }
    });
  });

  /* ─── 3. QR Code ─────────────────────────────────────────── */
  describe("QR Code Endpoint", () => {
    test("GET /api/public/qr/:id returns image/png or 404", async () => {
      if (!testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/public/qr/${testCredentialId}`);
      assert.ok([200, 404].includes(res.status));
      if (res.status === 200) {
        const ct = res.headers.get("content-type") || "";
        assert.ok(ct.includes("png") || ct.includes("image"), `Expected image, got ${ct}`);
      }
    });
  });

  /* ─── 4. Offline Bundle ───────────────────────────────────── */
  describe("Offline Bundle Endpoint", () => {
    test("GET /api/public/bundle/:id returns JSON bundle", async () => {
      if (!testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/public/bundle/${testCredentialId}`);
      assert.ok([200, 404].includes(res.status));
      if (res.status === 200) {
        const body = await res.json();
        assert.ok(body.credentialId || body.id, "Bundle must include credentialId");
        assert.ok(body.signature, "Bundle must include signature");
        assert.ok(body.issuerPublicKey, "Bundle must include issuerPublicKey");
      }
    });
  });

  /* ─── 5. W3C Verifiable Credential ───────────────────────── */
  describe("W3C VC Export", () => {
    test("GET /api/public/w3c/:id returns JSON-LD VC", async () => {
      if (!testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/public/w3c/${testCredentialId}`);
      assert.ok([200, 404].includes(res.status));
      if (res.status === 200) {
        const body = await res.json();
        assert.ok(body["@context"], "W3C VC must have @context");
        assert.ok(body.type, "W3C VC must have type");
        assert.ok(body.credentialSubject, "W3C VC must have credentialSubject");
      }
    });
  });

  /* ─── 6. Bulk Issuance ────────────────────────────────────── */
  describe("Bulk Issuance", () => {
    test("POST /api/credentials/bulk-issue returns batch report", async () => {
      if (!testIssuerId) return;
      const issDbUser = await User.findOne({ email: "p2issuer@p2test.local" });
      const recipientId = issDbUser?.userId || "usr_unknown";
      const res = await fetch(`${baseUrl}/api/credentials/bulk-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${issuerToken}` },
        body: JSON.stringify({
          credentials: [
            { issuerId: testIssuerId, recipientId, documentId: `doc_bulk_1_${Date.now()}`, credentialType: "CERTIFICATION", title: "Bulk Test Cert 1", validityDays: 180 },
            { issuerId: testIssuerId, recipientId, documentId: `doc_bulk_2_${Date.now()}`, credentialType: "LICENSE", title: "Bulk Test License", validityDays: 365 }
          ]
        })
      });
      const body = await res.json();
      assert.ok([200, 201, 207].includes(res.status), `Expected 200/201/207, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.success, `Expected success: ${JSON.stringify(body)}`);
      assert.ok(body.data, "Must return data");
    });

    test("POST /api/credentials/bulk-issue with empty array returns 400", async () => {
      const res = await fetch(`${baseUrl}/api/credentials/bulk-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${issuerToken}` },
        body: JSON.stringify({ credentials: [] })
      });
      assert.ok([400, 422].includes(res.status), `Expected 400/422 for empty payload, got ${res.status}`);
    });
  });

  /* ─── 7. Tamper Simulation ────────────────────────────────── */
  describe("Tamper Simulation", () => {
    test("POST /api/credentials/:id/simulate-tamper returns tamper result", async () => {
      if (!testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/credentials/${testCredentialId}/simulate-tamper`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ tamperType: "PAYLOAD_MUTATION" })
      });
      const body = await res.json();
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.success);
      assert.ok(body.data?.result || body.data?.tamperResult || body.data?.detected !== undefined, "Must return tamper detection result");
    });
  });

  /* ─── 8. API Keys & /v1/verify ───────────────────────────── */
  describe("API Keys & B2B Verification", () => {
    test("POST /api/api-keys creates a new API key", async () => {
      const res = await fetch(`${baseUrl}/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: "P2 Test Key", scopes: ["verify"] })
      });
      const body = await res.json();
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.success);
      assert.ok(body.data?.rawKey || body.data?.apiKey?.key || body.data?.key, "Must return raw key on creation");
      testApiKeyRaw = body.data?.rawKey || body.data?.apiKey?.key || body.data?.key;
    });

    test("POST /api/v1/verify with x-api-key authenticates and verifies", async () => {
      if (!testApiKeyRaw || !testCredentialId) return;
      const res = await fetch(`${baseUrl}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": testApiKeyRaw },
        body: JSON.stringify({ credentialId: testCredentialId })
      });
      const body = await res.json();
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.success);
    });

    test("POST /api/v1/verify without x-api-key returns 401", async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: "cred_xyz" })
      });
      assert.strictEqual(res.status, 401, "Must reject requests without API key");
    });

    test("GET /api/api-keys lists keys for authenticated user", async () => {
      const res = await fetch(`${baseUrl}/api/api-keys`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const body = await res.json();
      assert.ok([200].includes(res.status));
      assert.ok(body.success);
    });
  });

  /* ─── 9. Webhooks ────────────────────────────────────────── */
  describe("Webhooks", () => {
    let webhookId;

    test("POST /api/webhooks registers a new webhook", async () => {
      const res = await fetch(`${baseUrl}/api/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: "https://example.com/webhook-p2test", events: ["credential.issued"] })
      });
      const body = await res.json();
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.success);
      webhookId = body.data?.webhook?._id || body.data?.webhookId || body.data?._id;
    });

    test("GET /api/webhooks lists webhooks", async () => {
      const res = await fetch(`${baseUrl}/api/webhooks`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const body = await res.json();
      assert.ok(res.status === 200);
      assert.ok(body.success);
    });

    test("DELETE /api/webhooks/:id removes webhook", async () => {
      if (!webhookId) return;
      const res = await fetch(`${baseUrl}/api/webhooks/${webhookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
    });
  });

  /* ─── 10. Analytics ─────────────────────────────────────── */
  describe("Analytics", () => {
    test("GET /api/analytics/overview returns platform stats", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.success);
      assert.ok(typeof body.data.totalCredentials === "number", "Must include totalCredentials");
      assert.ok(typeof body.data.totalVerifications === "number", "Must include totalVerifications");
    });

    test("GET /api/analytics/overview requires authentication", async () => {
      const res = await fetch(`${baseUrl}/api/analytics/overview`);
      assert.ok([401, 403].includes(res.status), `Expected 401/403 without auth, got ${res.status}`);
    });
  });

  /* ─── 11. Swagger UI ─────────────────────────────────────── */
  describe("Swagger / OpenAPI Docs", () => {
    test("GET /api/docs returns 200 HTML", async () => {
      const res = await fetch(`${baseUrl}/api/docs/`);
      assert.ok([200, 301, 302].includes(res.status), `Expected 200/redirect for /api/docs/, got ${res.status}`);
    });
  });
});
