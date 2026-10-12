# SecureWork Verify 2.0 — Project Context (Phase 0)

**Status of this document:** Read-only repository analysis performed 2026-10-11.  
**Source of truth:** Implementation in this repository. Documentation was compared against code; mismatches are recorded rather than silently resolved.  
**This phase did not:** modify application logic, install dependencies, run seed/reset/cleanup, or execute the test suite.

Legend used throughout:

- **Verified in code** — observed in source files named below.
- **Partially implemented** — code exists but is incomplete, unused, or inconsistent.
- **Documented but not verified** — claimed in docs; not confirmed in execution (tests were not run in this phase).
- **Missing** — expected by docs, README, or UI, but no matching implementation found.
- **Unable to verify** — would require running services, credentials, or runtime observation.

---

## 1. Project purpose and scope

**Verified in code.** The npm package name is `securework-verify` (root `package.json`). README and `PROJECT_COMPLETE_DOCUMENTATION.md` describe it as a cryptographically verifiable workforce credential platform.

The running system is a **modular monolith**:

- Backend: Node.js + Express REST API (`backend/src/server.js` → `backend/src/app.js`).
- Frontend: React 18 SPA with Vite (`frontend/src/main.jsx` → `frontend/src/App.jsx`).
- Persistence: MongoDB via Mongoose, with local-daemon then `mongodb-memory-server` fallback (`backend/src/config/db.js`).
- Crypto: Ed25519 signing of a 9-field canonical payload; SHA-256 document hashes; hash-chained audit logs.

**Scope that exists in code:** auth/RBAC, organizations, issuers, issuer keys, document ingest, credential issue/version/revoke, verification engine, OCR/AI analysis, trusted sources, HR lookup, public verify/PDF/QR/W3C/offline bundle, audit chain, in-app notifications, API keys, webhook CRUD, analytics overview.

**Explicit non-goals documented in `PROJECT_RULES.md` / `docs/LIMITATIONS.md`:** no blockchain, no paid SaaS requirement, AI/OCR advisory only. ECDSA/RSA support is documented as a rule in `PROJECT_RULES.md` but **is not implemented** (issuer keys enum is `ED25519` only).

---

## 2. Technology stack

**Verified in code** (`package.json` workspaces, `backend/package.json`, `frontend/package.json`):

| Layer | Technology |
|---|---|
| Runtime | Node.js `>=18` |
| Backend | Express 4, Mongoose 8, Helmet, CORS, Morgan, Multer 2, bcryptjs, jsonwebtoken, swagger-ui-express |
| Crypto / media | Node `crypto`, pdfkit, qrcode, tesseract.js 7 |
| Optional storage | cloudinary |
| Optional email | nodemailer |
| Dev DB fallback | mongodb-memory-server |
| Frontend | React 18, react-router-dom 7, Vite 6, lucide-react, animejs, @fontsource/inter + jetbrains-mono |
| Tests | Node.js built-in `node:test` (backend + root smoke) |
| Orchestration | npm workspaces + concurrently |

**Missing:** Dockerfile / docker-compose (mentioned in `docs/DEPLOYMENT.md`). No frontend test runner.

---

## 3. Repository structure

```
SecureWork_verify_2.0/
├── backend/                 # Express modular monolith
│   ├── src/
│   │   ├── app.js           # Express app, helmet, CORS, rate limits, swagger, routes
│   │   ├── server.js        # listen, directory bootstrap, auto seedAdmin in development
│   │   ├── config/          # env.js, db.js
│   │   ├── middleware/      # auth, upload, rateLimiter, errorHandler, logger, apiKeyAuth
│   │   ├── routes/          # REST modules mounted at /api
│   │   ├── controllers/
│   │   ├── services/        # domain logic + adapters (storage, ocr, ai, crypto, sources, notification)
│   │   ├── models/          # Mongoose schemas
│   │   ├── adapters/        # re-exports of storage/ocr adapters (legacy path)
│   │   ├── utils/           # crypto, jwt, fileValidator, ssrfProtection, PDF/QR/W3C helpers
│   │   ├── validators/      # EMPTY (.gitkeep only)
│   │   ├── docs/swagger.js
│   │   └── scripts/         # seed.js, seedAdmin.js, demo.js
│   ├── tests/               # node:test suites
│   ├── keys/                # gitignored private key vault
│   └── storage/             # gitignored documents + temp
├── frontend/src/
│   ├── main.jsx, App.jsx
│   ├── pages/, components/, layouts/, context/, services/, config/, hooks/, styles/
├── docs/                    # architecture, API, crypto, OCR, security, etc.
├── scripts/                 # verify-foundation, verify-offline, phase flow scripts
├── tests/smoke.test.js
├── PROJECT_COMPLETE_DOCUMENTATION.md
├── PROJECT_RULES.md
└── README.md
```

README claims a `backend/src/validators/` module of input schemas. **Verified:** only `backend/src/validators/.gitkeep`. Validation is inline in services (`ValidationError`) plus `backend/src/utils/validation.js` (`isValidEmail`).

---

## 4. Frontend architecture

**Verified in code.**

Call path:

`main.jsx` → `App` (`ThemeProvider` → `AuthProvider` → `NotificationProvider` → `BrowserRouter` → `AppRoutes`) → page → `frontend/src/services/api.js` → `frontend/src/services/client.js` `apiClient` → `fetch` to `/api` (Vite proxy or `VITE_API_BASE_URL`).

| Piece | File | Role |
|---|---|---|
| Entry | `frontend/src/main.jsx` | Mounts React, self-hosted fonts, `index.css` |
| Router | `frontend/src/App.jsx` `AppRoutes` | All routes; `PageWrapper` maps legacy page IDs to paths |
| Auth | `frontend/src/context/AuthContext.jsx` | Session validate via `api.auth.getMe`; remember-me storage split |
| RBAC config | `frontend/src/config/permissions.js` | `ROLES`, `ROUTE_PERMISSIONS`, `CAPABILITIES`, `hasRouteAccess` |
| Shell | `frontend/src/layouts/AppLayout.jsx` | Navbar, Sidebar, NotificationDrawer, Outlet |
| Guards | `ProtectedRoute.jsx`, `RoleRoute.jsx` | JWT session; role allow-list |
| HTTP | `client.js` `apiClient` | Bearer token, FormData vs JSON, 401 logout |
| API map | `api.js` | Namespaced methods (duplicate `credentials` object — last wins) |
| Theme | `ThemeContext.jsx`, `styles/*.css` | Dark/light tokens |

**Auth storage (verified):** `sessionStorage` when remember-me is false; `localStorage` when true. Keys: `securework_token`, `securework_user`. Token is **not** treated as proof of session until `GET /api/auth/me` succeeds.

**Navigation (verified):** `Sidebar.jsx` sections by role. `ROLE_HOME_PAGES`: ADMIN `/admin/users`, ISSUER `/issuer/status`, AUDITOR `/audit/logs`, HR `/trusted-sources/verify`, USER `/dashboard`.

**Note:** `hasRouteAccess` returns true for **all** paths when role is ADMIN, including unmatched paths. `RoleRoute` also short-circuits ADMIN.

---

## 5. Complete route and page map

All routes from `frontend/src/App.jsx`. Auth: `ProtectedRoute` wraps the app shell. Roles: `RoleRoute allowedRoles`.

### Public (no login)

| Path | Component | Purpose | Auth | Roles | Main actions | APIs | Children / notes |
|---|---|---|---|---|---|---|---|
| `/` | `LandingPage.jsx` | Marketing / persona entry | No | — | Navigate login/register/verify | None required | `HeroVisualAnimation`, `SimplePricingPreview`, `FaqAccordion`, `PublicVerifyBox` |
| `/login` | `Login.jsx` | Sign in | No (redirects if already authed) | — | Submit, remember-me, password visibility, quick-fill | `api.auth.login` | `AnimatedBackground` |
| `/register` | `Register.jsx` | Public signup | No | — | Name/email/password/confirm | `api.auth.register` then navigates `dashboard` | Always creates USER on backend |
| `/verify/:credentialId` | `VerifyDocument.jsx` | Public deep-link verify | **No** (outside ProtectedRoute) | — | Same page as HR verify; can evaluate without login | `api.verifications.evaluate`, `api.public.verify` | Also used authenticated at `/verify` |
| `*` | Navigate `/` | Fallback | — | — | — | — | — |

### Authenticated shell (`ProtectedRoute` + `AppLayout`)

| Path | Component | Purpose | Roles | Main actions | APIs | Notable children |
|---|---|---|---|---|---|---|
| `/dashboard` | `UserDashboard.jsx` | Role-aware overview | ADMIN, USER, ISSUER, HR, AUDITOR | Health snapshot, recent creds/verifications | `health.check`, `credentials.list`, `verifications.list`; ADMIN/AUDITOR also `auditLogs.list`; ISSUER `issuerKeys.list` | `AnalyticsSection` (if rendered), `ApiKeysWebhooksSection` |
| `/upload` | `UploadDocument.jsx` | Ingest PDF/PNG/JPEG | ADMIN, USER | File pick, representation type, upload | `documents.upload` | — |
| `/verify` | `VerifyDocument.jsx` | HR/user verification | ADMIN, HR, USER | Credential ID / hash evaluate; HR subject lookup; manual review; simulate tamper (issuer/admin) | `verifications.evaluate`, `public.verify`, `hr.getSubjectCredentials`, `hr.verify`, `credentials.list`, `credentials.simulateTamper`, `verifications.submitManualReview` | `TrustEvidenceCard`, `ConfidenceRing` |
| `/history` | `VerificationHistory.jsx` | Past evaluations | ADMIN, USER, HR | Open report | `verifications.list`, `verifications.getById` | — |
| `/credentials` | `MyCredentials.jsx` | Holder wallet | ADMIN, USER | List, detail, public links | `credentials.list`, `credentials.getById` | Public PDF/bundle URLs via `api.public` |
| `/analysis` | `DocumentAnalysis.jsx` | OCR + heuristic AI | ADMIN, USER | Upload+analyze, run OCR, run AI, load by documentId | `analysis.upload`, `analysis.runOcr`, `analysis.runAi`, `analysis.getByDocumentId` | — |
| `/credentials/issue` | `IssueCredential.jsx` | Sign credential | ADMIN, ISSUER | Lookup recipient, issue, bulk CSV | `issuers.lookupRecipient`, `issuers.list`, `users.list`, `documents.list`, `credentials.issue`, `credentials.bulkIssue` | Sends `validityDays` (**backend ignores**; uses `expiresAt`) |
| `/credentials/all` | `CredentialList.jsx` | Issuer inventory | ADMIN, ISSUER | Versions, timeline, revoke | `credentials.list/getById/getVersions/getTimeline/revoke` | — |
| `/issuer/status` | `IssuerStatus.jsx` | Own issuer profile | ADMIN, ISSUER | View status | `issuers.list` | — |
| `/keys` | `KeyStatus.jsx` | Key lifecycle | ADMIN, ISSUER | Rotate, mark compromised | `issuers.list`, `issuerKeys.list/rotate/compromise` | Revoke UI may also exist — confirm on page |
| `/trusted-sources/verify` | `VerifyOfficialSource.jsx` | Query registry adapter | ADMIN, HR | Pick source + identifier | `trustedSources.list`, `credentials.list`, `verifications.verifySource` | — |
| `/audit/logs` | `AuditLogs.jsx` | Hash-chained logs | ADMIN, AUDITOR | Paginated list | `auditLogs.list` | — |
| `/audit/evidence` | `VerificationEvidence.jsx` | Discrete evidence | ADMIN, AUDITOR | Load by verification | `verifications.list`, `verifications.getEvidence` | — |
| `/audit/chain` | `AuditChainValidation.jsx` | Chain integrity | ADMIN, AUDITOR | Validate, checkpoint, list | `auditLogs.validateChain/listCheckpoints/list/createCheckpoint` | — |
| `/admin/users` | `AdminUsers.jsx` | User directory + roles | ADMIN | List, `updateRole` | `users.list`, `users.updateRole` | — |
| `/admin/organizations` | `AdminOrganizations.jsx` | Org trust | ADMIN | Create, verify, suspend, revoke | `organizations.*` | — |
| `/admin/organizations/:organizationId` | `AdminOrganizationDetail.jsx` | Org detail | ADMIN | Trust actions, related issuers/sources | `organizations.getById/verify/suspend/revoke`, `issuers.list/approve/suspend`, `trustedSources.list`, `auditLogs.list` | — |
| `/admin/trusted-sources` | `AdminTrustedSources.jsx` | Source governance | ADMIN | Register, approve, suspend, revoke, verify-domain | `trustedSources.*` | — |
| `/admin/issuers` | `AdminIssuers.jsx` | Issuer accreditation | ADMIN | Approve/suspend/revoke | `issuers.list/approve/suspend/revoke` | — |
| `/admin/settings` | `AdminSystemSettings.jsx` | Health flags | ADMIN | Refresh health | `health.check` | `ApiKeysWebhooksSection` may live here or dashboard |

**Frontend APIs present but not owned by a dedicated route page:** `api.apiKeys.*`, `api.webhooks.*`, `api.analytics.getOverview` (`ApiKeysWebhooksSection.jsx`, `AnalyticsSection.jsx`).

**Missing from frontend API client vs backend:** `GET /api/documents/:id/download` has no `api.documents.download` helper. `POST /api/issuers/:id/keys` generate-key is not wrapped (rotate is).

---

## 6. Backend architecture

**Verified in code.**

```
Frontend
  → apiClient /api/*
  → Express (app.js: helmet, requestId, CORS, morgan, rate limits, json/urlencoded)
  → /api router (routes/index.js)
  → route module (auth, jwt optional/required, requireRole, multer)
  → controller
  → service
  → Mongoose model and/or adapter (storage, keyStorage, OCR, AI, source, notification)
  → successResponse / errorHandler
  → UI
```

**Entry:** `backend/src/server.js` `startServer()`:

1. `ensureDirectories()` for `KEY_STORAGE_PATH`, `STORAGE_PATH`, `TEMP_STORAGE_PATH`.
2. `connectDB()`.
3. If `env.IS_DEVELOPMENT`, auto-run `scripts/seedAdmin.js` (non-fatal on failure).
4. Listen on `env.PORT` (default 5000); timeouts 30s/35s/30s.

**App (`app.js`):** Helmet `crossOriginResourcePolicy: cross-origin`; CORS allowlist `FRONTEND_URL` + localhost:5173; in `development`/`test` **all origins allowed**. Rate limit: `/api/auth` 100/15min; `/api/verifications/evaluate` 60/min. Body limit = `MAX_FILE_SIZE_MB` mb. Swagger at `/api/docs`. Routes at `/api`. Root `GET /` service banner (still says “Phase 1”). 404 + `errorHandler` (no stack traces to client).

**Controllers** live in `backend/src/controllers/*.controller.js` and generally call one service then `successResponse`.

**Adapters (verified):**

| Concern | Interface | Default implementation |
|---|---|---|
| Files | `services/storage/storage.adapter.js` | `localStorage.adapter.js`; Cloudinary if `STORAGE_DRIVER=cloudinary` |
| Keys | `services/crypto/keyStorage.adapter.js` | `localKeyStorage.adapter.js` |
| OCR | `services/ocr/ocr.adapter.js` | `localOcr.adapter.js` |
| AI | `services/ai/ai.adapter.js` | `localAi.adapter.js` |
| Sources | `services/sources/sourceVerification.adapter.js` | `LocalSourceVerificationAdapter` default; `HttpSourceVerificationAdapter` exists |
| Notifications | `services/notification/notification.adapter.js` | `localNotification.adapter.js` (DB + console) |

`backend/src/adapters/*.js` re-export storage/OCR adapters; live selection is `services/storage/index.js` and `services/ocr/index.js`.

---

## 7. API endpoint map

Base path: `/api`. Unless noted, JSON envelope `{ success, data }` via `utils/response.js`.

### Health / index

| Method | Path | Auth | Roles | Handler | Notes |
|---|---|---|---|---|---|
| GET | `/` (app root, not /api) | none | — | `app.js` | Banner |
| GET | `/api` | none | — | `routes/index.js` | Index; claims “Phase 13” |
| GET | `/api/health` | none | — | `health.controller.getHealth` | DB, OCR/AI flags, storage |
| GET | `/api/docs` | none | — | swagger-ui | Spec in `docs/swagger.js` |

### Auth (`auth.routes.js` → `auth.controller` → `auth.service`)

| Method | Path | Auth | Payload | Service |
|---|---|---|---|---|
| POST | `/api/auth/register` | public + authLimiter | `{ name, email, password }` | `AuthService.register` — **always role USER** |
| POST | `/api/auth/login` | public + authLimiter | `{ email, password }` | `AuthService.login` |
| GET | `/api/auth/me` | JWT | — | `AuthService.getCurrentUser` |

### Users (`user.routes.js` → `user.controller` → `user.service`)

| Method | Path | Auth | Roles |
|---|---|---|---|
| GET | `/api/users/me` | JWT | any |
| PATCH | `/api/users/me` | JWT | any |
| PATCH | `/api/users/:id/role` | JWT | ADMIN |
| GET | `/api/users/:id` | JWT | self or ADMIN/AUDITOR (enforced in service — **Unable to verify** every branch without reading remaining `user.service.js` lines; controller exists) |
| GET | `/api/users` | JWT | ADMIN, AUDITOR |

### Organizations (`organization.routes.js`)

| Method | Path | Auth | Roles |
|---|---|---|---|
| GET | `/api/organizations` | **none** | public list |
| GET | `/api/organizations/:id` | **none** | public |
| POST | `/api/organizations` | JWT | **any authenticated** (docs say Admin only — discrepancy) |
| POST | `/api/organizations/:id/verify` | JWT | ADMIN |
| PATCH | `/api/organizations/:id/suspend` | JWT | ADMIN |
| PATCH | `/api/organizations/:id/revoke` | JWT | ADMIN |

### Issuers (`issuer.routes.js`)

| Method | Path | Auth | Roles |
|---|---|---|---|
| POST | `/api/issuers/register` | JWT | any (creates PENDING issuer) |
| GET | `/api/issuers/me` | JWT | any |
| GET | `/api/issuers/recipients/lookup` | JWT | ADMIN, ISSUER |
| GET | `/api/issuers/:id` | JWT | any authed |
| GET | `/api/issuers` | JWT | any authed |
| PATCH | `/api/issuers/:id/approve\|suspend\|revoke` | JWT | ADMIN |
| POST | `/api/issuers/:id/keys` | JWT | ADMIN, ISSUER |
| POST | `/api/issuers/:id/rotate-key` | JWT | ADMIN, ISSUER (docs: Admin only — discrepancy) |

### Issuer keys (`issuerKey.routes.js`)

| Method | Path | Auth | Roles |
|---|---|---|---|
| GET | `/api/issuer-keys` | **none** | public public-key metadata |
| GET | `/api/issuer-keys/:id` | **none** | public (no private key; `select: false` + toJSON strip) |
| PATCH | `/api/issuer-keys/:id/compromise` | JWT | ADMIN, ISSUER |
| PATCH | `/api/issuer-keys/:id/revoke` | JWT | ADMIN, ISSUER |

### Documents (`document.routes.js`)

All JWT. Upload uses `handleDocumentUpload` (multer memory, fields `file` or `document`).

| Method | Path | Roles in route | Service |
|---|---|---|---|
| POST | `/api/documents/upload` | any authed; ingest requires user | `DocumentService.ingestDocument` |
| GET | `/api/documents` | owner unless ADMIN/AUDITOR/ISSUER | `listDocuments` (**HR not privileged**) |
| GET | `/api/documents/:id` | access check | `getDocumentMetadata` |
| GET | `/api/documents/:id/download` | access check | `getDocumentDownload` |

### Credentials (`credential.routes.js`) — all JWT

| Method | Path | Roles | Service |
|---|---|---|---|
| POST | `/api/credentials/issue` | ADMIN, ISSUER | `issueCredential` |
| POST | `/api/credentials/bulk-issue` | ADMIN, ISSUER | `bulkIssue` |
| POST | `/api/credentials/:id/simulate-tamper` | ADMIN, ISSUER | `simulateTamper` |
| GET | `/api/credentials` | scoped: USER → own recipientId; others unscoped | `listCredentials` |
| GET | `/api/credentials/:id/timeline` | JWT | `getCredentialTimeline` |
| GET | `/api/credentials/:id/versions` | JWT | versions |
| POST | `/api/credentials/:id/versions` | ADMIN, ISSUER | `createCredentialVersion` |
| PATCH | `/api/credentials/:id/revoke` | ADMIN, ISSUER | `revokeCredential` |
| GET | `/api/credentials/:id` | JWT | `getCredentialById` |

`CredentialService.checkReadAccess` **always returns true** after a few checks — effectively public-to-any-authenticated-user for get/timeline if they know the id.

### Verifications (`verification.routes.js`)

| Method | Path | Auth | Roles |
|---|---|---|---|
| GET | `/api/verifications` | optional JWT | public/list |
| POST | `/api/verifications/evaluate` | optional + evalLimiter | `VerificationService.evaluateCredentialVerification` |
| POST | `/api/verifications/verify-source` | optional | trusted source query |
| GET | `/api/verifications/:id/evidence` | optional | evidence records |
| POST | `/api/verifications/:id/manual-review` | JWT | ADMIN, AUDITOR, HR |
| GET | `/api/verifications/:id` | optional | report |
| GET | `/api/verifications/credential/:credentialId` | JWT | history |

### Analysis (`ocr.routes.js` mounted at `/api/analysis`)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/analysis/upload` | **optional JWT** then multer then `ocr.controller.uploadAndAnalyze` |
| POST | `/api/analysis/document` | optional | AI |
| POST | `/api/analysis/ocr` | optional | OCR |
| GET | `/api/analysis/:documentId` | optional | latest OCR+AI |

**Partial:** upload path calls `documentService.ingestDocument` which **requires** `user.userId`. Anonymous upload therefore fails at ingest. Also passes `representationType: 'ORIGINAL_PDF'` which is **not** in `REPRESENTATION_TYPES` enum.

### Audit (`auditLog.routes.js`) — JWT + ADMIN, AUDITOR

| Method | Path |
|---|---|
| GET | `/api/audit-logs/validate` |
| POST | `/api/audit-logs/checkpoint` |
| GET | `/api/audit-logs/checkpoints` |
| GET | `/api/audit-logs` |

No update/delete routes (verified).

### Notifications — JWT

GET `/`, PATCH `/read-all`, PATCH `/:id/read`.

### Public (`public.routes.js`) — no login

GET `/api/public/verify/:id`, `/pdf/:id`, `/bundle/:id`, `/w3c/:id`, `/qr/:id`, `/revocations`.

### B2B

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/verify` | `x-api-key` (`authenticateApiKey`) → `verificationEngine.evaluateVerification` |
| POST/GET/DELETE | `/api/api-keys` | JWT |
| POST/GET/DELETE | `/api/webhooks` | JWT |
| GET | `/api/analytics/overview` | JWT |

### HR (`hr.routes.js`) — JWT + ADMIN, HR + 60/min limiter

| Method | Path |
|---|---|
| GET | `/api/hr/subjects/:userIdOrEmail/credentials` |
| POST | `/api/hr/verify` |

**Tests:** backend `tests/*.test.js` cover many of these domains (auth, rbac, crypto, verification, ocr, ai, audit, documents, org trust, trusted sources, notifications, public verify, persona, credentials, security). **Documented but not verified:** pass/fail of current suite (not executed this phase).

---

## 8. Database model relationships

**Verified in code** (`backend/src/models/*`). Most foreign keys are **string business IDs**, not ObjectId refs (except `User.organizationId` → `Organization`).

```
User.userId (usr_*)
  ├─ organizationId → Organization._id (ObjectId, optional)  [inconsistent with other string org IDs]
  ├─ Issuer.userId (1:1)
  ├─ Document.uploadedBy
  ├─ Credential.recipientId
  ├─ Notification.recipientUserId
  ├─ ApiKey.userId / Webhook.userId
  └─ AuditLog.performedBy

Organization.organizationId (org_*)
  ├─ Issuer.organizationId (string)
  ├─ Credential.organizationId
  └─ TrustedSource.organizationId

Issuer.issuerId (iss_*)
  ├─ IssuerKey.issuerId
  └─ Credential.issuerId

IssuerKey.keyId (key_*)
  └─ CredentialVersion.issuerKeyId
     privateKeyReference → filesystem pointer (never in JSON)

Document.documentId (doc_*)
  ├─ CredentialVersion.documentId
  ├─ Verification.documentId
  ├─ OcrAnalysis.documentId
  └─ AIAnalysis.documentId

Credential.credentialId (crd_*)
  ├─ currentVersionId → CredentialVersion.versionId
  ├─ CredentialVersion.credentialId
  └─ Verification.credentialId

Verification.verificationId (vrf_*)
  └─ VerificationEvidence.verificationId (immutable)

AuditLog.sequenceNumber + previousHash/currentHash
AuditCheckpoint.sequenceStart/End + chainHeadHash
```

**Indexes:** unique on business IDs, emails, organizationCode, issuerCode, sourceCode, hashes, sequenceNumber.

**Immutability hooks (verified):** `AuditLog` and `VerificationEvidence` reject updates in Mongoose middleware. MongoDB itself is not claimed immutable (`audit.service.js` comments).

---

## 9. Document storage architecture

**Verified in code.**

1. Multer `memoryStorage` (`middleware/upload.js`), 10 MB, fields `file`/`document`.
2. `fileValidator.validateFileCharacteristics`: magic bytes PDF/PNG/JPEG; block PE/ELF/shebang; allowed extensions `.pdf .png .jpg .jpeg`.
3. `StorageService.uploadFile` → `getStorageAdapter()`.
4. **Local adapter** (`localStorage.adapter.js`): SHA-256 of buffer; store as `{hash16}_{random}{ext}` under `STORAGE_PATH` (default `backend/storage/documents`); mode `0640`; path traversal blocked via `path.basename` + prefix check. Returns `storagePath` as **basename key**.
5. Document record: `documentId`, `sha256Hash`, `storagePath`, `uploadedBy`, `mimeType`, `representationType`.
6. Download: resolve key → stream path.

**Cloudinary:** selected when `STORAGE_DRIVER=cloudinary` (`services/storage/index.js`). Credentials from env. **Unable to verify** live Cloudinary behavior.

**Temp dir:** `TEMP_STORAGE_PATH` created at startup. Upload path uses **memory**, not temp files. Temp usage beyond directory creation: **Unable to verify** without full adapter/OCR scan; OCR uses in-memory buffers.

**Data-loss risks (verified by design):**

- `mongodb-memory-server` fallback: **all DB records vanish on process exit**.
- Local files persist on disk independently of memory DB → orphan files or dangling `storagePath` after restart with memory DB.
- Seed `createMockDoc` writes `storagePath: docPath` as **absolute path**; runtime ingest stores **basename**. Local `resolvePath` rejects keys containing `/` unless basename equals the key — **seed files may be unreadable through the adapter** depending on OS path format.
- Cloudinary misconfig / placeholder: adapter has `isPlaceholder` helper — **Unable to verify** fallback behavior without reading remaining Cloudinary adapter.

**Hash:** always server-side SHA-256 (`utils/crypto.js` `sha256`). Client hashes are not trusted for ingest.

---

## 10. OCR and AI analysis workflows

**Verified in code.**

```
Upload/select document
  → Document record + SHA-256
  → OcrService.analyzeDocument
       getFile → hash must match stored hash
       LocalOCRAdapter.extractText
         PDF: pdfExtractor.extractFromPdf (text streams); if empty, Tesseract on first embedded image
         Image: Tesseract.js worker, 15s timeout, 10 MB cap
       persist OcrAnalysis (does not mutate document)
  → AIService.analyzeDocument
       load latest OCR + file bytes
       LocalAIAdapter.analyze (heuristics)
       persist AIAnalysis
  → GET /api/analysis/:documentId combines latest OCR + AI
  → DocumentAnalysis.jsx displays
```

**Genuine implementations:** Tesseract.js (if package resolves), PDF stream text extraction (`services/ocr/pdfExtractor.js`), hash integrity guards, analysis records.

**Heuristic (advisory):** `LocalAIAdapter` PDF incremental xref/trailer, editing-software keywords, CreationDate vs ModDate, JPEG Photoshop 8BIM, DQT counts, OCR keyword/field heuristics, anomalyScore → LOW/MEDIUM/HIGH. **Not** a trained ML model despite `modelName`.

**Missing / partial:**

- `eng.traineddata` **not in repository**. Offline Tesseract may download or fail — **Unable to verify** without running OCR.
- `OCR_ENABLED` / `AI_ENABLED` are env-validated and shown on health; **services do not gate on them**.
- No rasterization of vector-only PDFs without embedded images (`docs/LIMITATIONS.md` agrees).
- Analysis routes optional-auth; ingest still needs a user.
- `ocr.controller.getDocumentAnalysis` if both missing still calls OCR get (will 404).

**Invariant (verified in verification engine synthesis):** invalid signature → `SIGNATURE_INVALID` **before** AI/OCR can produce VERIFIED. AI failure cannot override crypto failure. OCR check default-passes if `ocrData` not supplied.

---

## 11. Credential issuance and verification workflows

### Issue (verified)

```
ADMIN/ISSUER
  → optional document upload (USER/ADMIN typically upload; ISSUER can list all docs)
  → POST /api/credentials/issue
  → CredentialService.issueCredential
       issuer ACTIVE + actor owns issuer (or ADMIN)
       IssuerKeyService.getActiveKeyForIssuer
       Document exists (hash copied, not recomputed)
       Recipient User exists (userId or email)
       buildCanonicalPayload (9 fields)  [utils/credentialPayload.js]
       issuerKeyService.signPayload(keyId, payload)  [Ed25519, private key from vault]
       CredentialVersion v1 + Credential ACTIVE
       audit CREDENTIAL_ISSUED
       notificationService.notifyUser CREDENTIAL_ISSUED
```

**Not wired:** `email.service.sendCredentialIssuedEmail` is **never called** from credential service. `webhook.service.dispatchEvent` is **never called** from issuance/ingest.

Frontend sends `validityDays`; backend only reads `expiresAt`. Default expiry on issue UI may not persist.

### Analyze vs upload vs issue vs verify vs notify vs revoke

| Action | What it does | Roles (backend) |
|---|---|---|
| Upload document | Store bytes + hash + metadata | Any authenticated (`ingestDocument`); UI: ADMIN, USER |
| Analyze document | OCR/AI records; does not sign | Optional JWT; ingest still needs user |
| Issue credential | Canonical sign + persist | ADMIN, ISSUER; issuer must be ACTIVE |
| Verify | 16-check engine + persist Verification | Public or JWT |
| Notification | In-app row to recipient | System after issue/revoke/etc. |
| Revoke | Status REVOKED + reason; versions not deleted | ADMIN, ISSUER (owner check) |
| Version | New signed payload; old SUPERSEDED | ADMIN, ISSUER |
| Simulate tamper | Demo mutation of signature/payload | ADMIN, ISSUER |

### Verify (verified)

`VerificationService.evaluateCredentialVerification` → `VerificationEngine.evaluateVerification` (16 checks in `verificationConstants.CHECK_NAMES`) → persist `Verification` + `VerificationEvidence` + audit + notify.

Public: `GET /api/public/verify/:id` runs engine without requiring login. `PublicController` then builds a weighted “confidence” UI breakdown using `evalResult.cryptographicStatus` / `documentStatus` — **those fields are not returned** by `evaluateVerification` (it returns `result`, `trustLevel`, `checks`, `evidence`, `warnings`, `explanation`). Confidence breakdown may always show failed crypto/integrity **unless** later code maps checks. **Partially implemented / investigate.**

Also looks up `credential.issuerKeyId` which is **not on Credential schema** (it is on `CredentialVersion`).

---

## 12. Cryptographic architecture

**Verified in code** (`utils/crypto.js`, `credentialPayload.js`, `issuerKey.service.js`, `jwt.js`).

| Function | Location | Behavior |
|---|---|---|
| `canonicalizeJson` | `utils/crypto.js` | Sorted-key JSON (RFC 8785 **subset**, not a full JCS library) |
| `sha256` / `sha256Stream` | same | Hex digest |
| `timingSafeCompare` | same | `crypto.timingSafeEqual` |
| `generateEd25519KeyPair` | same | SPKI + PKCS8 PEM |
| `signEd25519` / `verifyEd25519` | same | `crypto.sign/verify(null, …)` |
| `buildCanonicalPayload` | `utils/credentialPayload.js` | 9 fields, ISO timestamps |
| `verifyCredentialSignature` | same | canonicalize string then verifyEd25519 |
| JWT | `utils/jwt.js` | HS256 only (`algorithms: ['HS256']`); claims sub, userId, role, email |
| Password | `User.hashPassword` / `comparePassword` | bcryptjs salt 10 |
| Key store | `LocalKeyStorageAdapter` | files under `KEY_STORAGE_PATH`, chmod 600 on POSIX |
| Rotation | `IssuerKeyService` | new ACTIVE, previous RETIRED |
| Compromise/revoke | same | status flags; historical signatures remain |

**Documented but not implemented:** ECDSA P-256, RSA, SHA-512, Merkle paths (`PROJECT_RULES.md`).

**Private keys:** stripped by `baseModel.plugin.js`; `privateKeyReference` `select: false`. Do not log or copy `backend/keys/*`.

---

## 13. Authentication and authorization

**Verified in code.**

- Register: public, role forced `USER`, password ≥ 8, unique email.
- Login: bcrypt compare; uniform invalid-credentials; inactive blocked.
- JWT required via `authenticateUser`; user reloaded from DB; `status !== ACTIVE` rejected.
- `optionalAuthenticateUser` for public verify/analysis.
- RBAC `requireRole(...)`.
- Frontend RoleRoute + Sidebar.

**Partially implemented / gaps:**

- Organization list/get and issuer-key list/get are unauthenticated.
- Credential `checkReadAccess` is a no-op success.
- HR cannot list documents unless owner (HR not in `checkDocumentAccess` privileged set).
- API key user role is synthetic `'VERIFIER'` (not in User.ROLES).
- CORS wide-open in development/test.
- `JWT_SECRET` default `CHANGE_ME` allowed outside production (`env.js`).
- Rate limiter is **in-process Map** (not Redis). Fine for single node.

**Documented but not verified:** full RBAC matrix tests (`rbac.test.js`, `rbacFullMatrix.test.js`) — files exist; not run this phase.

---

## 14. Notification and email workflows

**In-app (verified):** `NotificationService` → `LocalNotificationAdapter.send` persists `Notification` and logs. Inbox: `NotificationContext.jsx` polls `api.notifications.list`. Events include credential issued (from `issueCredential`), plus other services that call `notifyUser` / `notifyRole` (issuer/key/org — **not fully enumerated here**).

**Email (partial):** `EmailService` uses SMTP env in production if `SMTP_HOST` set; else Ethereal (`port 5887` — unusual vs typical 587) or JSON transport. Methods `sendCredentialIssuedEmail`, `sendCredentialVerifiedEmail` exist. **No callers found** outside `email.service.js`. SMTP vars **not** in `backend/.env.example`.

**Webhooks (partial):** CRUD + HMAC `X-SecureWork-Signature: t=ts,v1=hex` over `timestamp.body`. `dispatchEvent` exists. **No production call sites** from credential/document/verification services. Import `isPrivateIp` from `ssrfProtection.js` **does not exist** (export is `isPrivateOrBlockedIp`) and is unused in `_sendPayload`. Outbound webhook SSRF filtering is **missing** on dispatch (http(s) check only at register).

---

## 15. Audit logging and integrity validation

**Verified:** `AuditService.appendLog` serializes with an in-process lock; genesis `SHA256("GENESIS_SECUREWORK_VERIFY")`; `currentHash = sha256(JSON.stringify(canonical fields + previousHash))`; `recordEvent` infers `targetType` from ID prefix.

`validateChain` (in remaining `audit.service.js`) is used by `GET /api/audit-logs/validate`. Checkpoints: `AuditCheckpoint` with `externalAnchorType` default `INTERNAL_LOCAL`.

**Limitations (code comments):** MongoDB can still be edited at disk/admin level; chain detects tamper. Multi-instance lock is **not** distributed. Memory DB loses the chain on restart.

---

## 16. External integrations and adapters

| Integration | Status |
|---|---|
| MongoDB Atlas / local | Verified connection + fallback |
| mongodb-memory-server | Verified fallback when URI placeholder or connect fails |
| Cloudinary | Partial adapter; optional |
| Tesseract.js | Dependency + adapter; traineddata not in repo |
| Nodemailer / Ethereal | Partial, unused from domain services |
| HTTP official registries | `HttpSourceVerificationAdapter` + `ssrfProtection.safeFetch` (HTTPS, allowlist domain, block private IPs) |
| Local synthetic registries | `LocalSourceVerificationAdapter` **default** — not live government APIs |
| Swagger UI | `/api/docs` |
| W3C VC export | `utils/w3cFormatter.js` via public route |
| QR | `qrcode` via `public.controller.getQrCode` |
| PDF certificate | `utils/certificatePdf.js` |
| Offline bundle | `utils/offlineBundle.js` |
| Docker | **Missing** (docs describe it) |

---

## 17. Environment configuration

**Backend** (`backend/.env.example` + `config/env.js` `validateEnv`):

| Variable | Default / notes |
|---|---|
| NODE_ENV | development \| test \| production |
| PORT | 5000 |
| MONGODB_URI | mongodb://127.0.0.1:27017/securework_verify; placeholders trigger fallback |
| JWT_SECRET | CHANGE_ME; production requires ≥32 chars and not CHANGE_ME |
| JWT_EXPIRES_IN | 24h (`docs/API.md` says 1h — discrepancy) |
| KEY_STORAGE_PATH | ./keys |
| STORAGE_PATH | ./storage/documents |
| TEMP_STORAGE_PATH | ./storage/temp |
| MAX_FILE_SIZE_MB | 10 |
| STORAGE_DRIVER | local \| cloudinary |
| CLOUDINARY_* | optional |
| FRONTEND_URL | http://localhost:5173 |
| OCR_ENABLED / AI_ENABLED | true (health only) |
| OCR_ENGINE / AI_ENGINE | local (selection of extra engines **not wired** beyond local adapters) |

**Not in env.example but used:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` (`email.service.js`).

**Frontend:** `VITE_API_BASE_URL` (example `http://localhost:5000/api`). Client also accepts `VITE_API_URL`. Vite proxy `/api` → `localhost:5000`.

Do not commit real `.env` values. Templates contain placeholders only.

---

## 18. Development and testing commands

**Install (do not run in this phase):** `npm install` at repo root (workspaces).

| Command | What |
|---|---|
| `npm run dev` | concurrently backend `--watch` + Vite |
| `npm run dev:backend` | `node --watch src/server.js` |
| `npm run dev:frontend` | Vite :5173 |
| `npm run build` | frontend `vite build` |
| frontend `npm run preview` | vite preview |
| `npm run test` | `npm run test --workspace=backend` → `node --test --test-concurrency=1 tests/*.test.js` |
| `npm run seed` | `node backend/src/scripts/seed.js` — **creates demo users/orgs/keys/credentials** (do not run unless requested) |
| `npm run demo` | `backend/src/scripts/demo.js` |
| `backend` `npm run seed:admin` | `seedAdmin.js` (also auto in development server start) |
| `npm run verify` / `verify:offline` | foundation / offline scripts |

**Seed demo accounts (from README + `seed.js`; these are demo passwords, not production secrets):** admin, auditor, two issuers, HR, alice/bob/carol. **Do not run seed in audits unless instructed.**

**Tests present (not executed this phase):** 23 files under `backend/tests/` plus `tests/smoke.test.js`. Scripts `scripts/test_phase3_flow.js` … `test_phase6_flow.js`, `final_integration_test.js`. Frontend: **no test script**.

---

## 19. Existing known limitations

From code + `docs/LIMITATIONS.md` (aligned unless noted):

- OCR raster/PDF limits; analog fraud undetectable.
- AI is heuristic, advisory.
- In-memory rate limiter / audit lock: single process.
- Keys on local filesystem, not HSM/KMS.
- Official sources: local adapter default, not live agencies.
- Memory MongoDB: ephemeral.
- No cluster/queue (`LIMITATIONS.md` future).
- Canonicalization is a subset of RFC 8785.
- Ethereal email unused; webhook dispatch unused.
- Frontend `validityDays` ignored.

---

## 20. Documentation-versus-code discrepancies

| Claim | Reality |
|---|---|
| README / `app.js` “Phase 1” vs routes index “Phase 13” vs docs “complete” | Versioning strings are inconsistent |
| `docs/API.md`: JWT expires 1h | `JWT_EXPIRES_IN` default `24h` |
| `docs/API.md`: POST organizations Admin only | Any authenticated user |
| `docs/API.md`: rotate-key Admin only | ADMIN or ISSUER |
| `PROJECT_RULES.md`: ECDSA/RSA | Only ED25519 |
| README validators directory | Empty `.gitkeep` |
| `docs/DEPLOYMENT.md` Docker | No Dockerfile in repo |
| `docs/LIMITATIONS.md` RBAC omits HR | HR role exists throughout |
| Cloudinary “adapter only” in LIMITATIONS | Cloudinary adapter **is implemented** and selectable |
| “RFC 8785 JCS” | Custom sorted-key serializer |
| Email on credential issue | In-app only |
| `OCR_ENABLED` disables OCR | Health flag only |
| `PROJECT_COMPLETE_DOCUMENTATION.md` “authoritative from codebase” | Contains the same docs drift; treat as secondary |
| Public verify confidence uses `cryptographicStatus` on engine result | Engine return object does not include those fields |
| Frontend issue form `validityDays` | Backend `expiresAt` |

---

## 21. Missing or incomplete implementations

- Joi/Zod validators module.
- Email + webhook event emission from domain services.
- Webhook SSRF on delivery (`isPrivateIp` broken import).
- Feature-flag enforcement for OCR/AI engines.
- Frontend download helper; generate-key API wrapper.
- Frontend tests; Docker; `eng.traineddata`.
- Distributed rate limit / audit sequencing.
- `Credential.checkReadAccess` actual restriction.
- Analysis anonymous upload.
- `ORIGINAL_PDF` representation type.
- SMTP documented in `.env.example`.
- API key `VERIFIER` role vs User enum.

---

## 22. Critical files and dependencies that must not be changed casually

Treat as high-regression / high-security:

- `backend/src/utils/crypto.js`, `credentialPayload.js`, `jwt.js`
- `backend/src/services/issuerKey.service.js`, `services/crypto/localKeyStorage.adapter.js`
- `backend/src/services/verification/verificationEngine.js`, `verificationConstants.js`
- `backend/src/services/credential.service.js`, `audit.service.js`
- `backend/src/middleware/auth.js`, `apiKeyAuth.js`, `upload.js`
- `backend/src/utils/fileValidator.js`, `ssrfProtection.js`
- `backend/src/models/*` especially AuditLog, CredentialVersion, IssuerKey, User
- `backend/src/config/env.js`, `config/db.js`
- `frontend/src/config/permissions.js`, `services/client.js`, `context/AuthContext.jsx`, `App.jsx`
- `backend/keys/**`, `.env`, any PEM/key files
- Hash-chain genesis string and payload field set (changing breaks verification of existing credentials)

---

## 23. Potential regression risks

- Changing the 9-field payload or canonicalization **invalidates all existing signatures**.
- Changing audit hash recipe **breaks chain validation** of historical logs.
- Broadening CORS / JWT algorithms / role checks weakens security.
- Switching storage driver without migrating `storagePath` loses downloads and OCR.
- Memory DB in development: tests and UI appear empty after restart; seedAdmin may recreate users without documents.
- Duplicate `api.credentials` in `api.js`: future edits to the first object are dead code.
- `simulateTamper` in production would undermine demo integrity if left unrestricted (currently ADMIN/ISSUER).
- Multer/file-type changes can reject legitimate PDFs or admit unsafe types.
- Seed absolute `storagePath` vs basename adapter.

---

## 24. Areas that require further investigation

1. Remaining methods in `user.service.js`, `issuer.service.js`, `organization.service.js`, `trustedSource.service.js`, `hr.service.js`, `evidence.service.js`, `apiKey.service.js` (prefix/hash of keys), `analytics.controller.js`.
2. Whether `PublicController` confidence mapping is fixed later in the file.
3. `LocalKeyStorageAdapter` file naming and Windows ACL vs POSIX 0600.
4. Cloudinary adapter placeholder/fallback and whether hashes match local.
5. Whether `setSourceAdapter(httpAdapter)` is ever selected by env.
6. `scripts/demo.js` and phase flow scripts side effects.
7. Test suite current pass/fail (must run non-destructively in a later phase).
8. `ocr.controller.uploadAndAnalyze` ORIGINAL_PDF failure in live UI.
9. Notification poll interval and unread badge.
10. Swagger spec completeness vs actual routes.
11. `trust.service.js` usage vs organization verification.
12. Whether ISSUER listing credentials is org-scoped or global (`listCredentials` does not scope ISSUER).
13. `Login.jsx` persona mismatch imports `logout` from AuthContext module (may not be a named export).
14. HR verify vs public evaluate duplication on `VerifyDocument.jsx`.

---

## Rules for subsequent audit phases

1. Preserve existing architecture unless a confirmed defect requires a change.
2. Reuse existing implementations before creating new services or APIs.
3. Never remove a file based only on its name or lack of direct imports (`adapters/`, `validators/.gitkeep`, `email.service.js`, webhook dispatch).
4. Never replace real functionality with mock data.
5. Never weaken cryptographic or authorization guarantees.
6. Never delete user data, secrets, keys, or production records.
7. Never claim a feature works without test evidence.
8. Make minimal, targeted, evidence-based changes.
9. Add regression tests when fixing defects.
10. Rerun relevant tests after modifications.
11. Maintain the existing UI design unless a UI defect requires correction.
12. Clearly report anything blocked by missing configuration or external services.

---

*End of Phase 0 context. Wait for the next instruction before changing application code.*
