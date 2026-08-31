# REST API Specification

## 1. API Design Conventions

All endpoints adhere to strict RESTful conventions:
* **Transport**: HTTPS in production; JSON payloads for requests and responses.
* **Authentication**: `Authorization: Bearer <JWT_TOKEN>`.
* **Standard Response Envelope**:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": {
      "timestamp": "2026-08-31T12:00:00.000Z",
      "requestId": "59a88accfe6ed62f..."
    }
  }
  ```
* **Standard Error Envelope**:
  ```json
  {
    "success": false,
    "error": {
      "message": "Descriptive error message",
      "code": "ERROR_CODE_STRING",
      "statusCode": 400,
      "timestamp": "2026-08-31T12:00:00.000Z"
    }
  }
  ```

---

## 2. Complete Implemented Endpoint Catalog

### System & Health
* `GET /api`: System status and active module registry index.
* `GET /api/health`: Node.js process health, memory usage, uptime, and MongoDB connection state.

### Authentication (`/api/auth`)
* `POST /api/auth/register`: Public registration (default role `USER`; role escalation sanitized; password hashed with bcrypt).
* `POST /api/auth/login`: Authenticate with email/password; returns JWT (`HS256`, 1h expiration) and sanitized user profile.
* `GET /api/auth/me`: Fetch authenticated user profile.

### Users (`/api/users`)
* `GET /api/users/me`: Retrieve current user profile.
* `PATCH /api/users/me`: Update profile fields (`name`). Prevents role escalation.
* `GET /api/users/:id`: Fetch specific user profile (Admin or self).
* `PATCH /api/users/:id/role`: Update user role (`ADMIN` only).

### Organizations (`/api/organizations`)
* `POST /api/organizations`: Register an accredited institution (Admin only).
* `GET /api/organizations`: List organizations with filtering and pagination.
* `GET /api/organizations/:id`: Retrieve organization details.
* `POST /api/organizations/:id/verify`: Approve and verify organization with accreditation evidence (Admin only).
* `PATCH /api/organizations/:id/suspend`: Suspend organization (Admin only).
* `PATCH /api/organizations/:id/revoke`: Revoke organization and cascade revocation to associated issuers (Admin only).

### Issuers (`/api/issuers`)
* `POST /api/issuers/register`: Submit an issuer accreditation profile bound to a verified organization (`status: PENDING`).
* `GET /api/issuers`: List accredited issuers.
* `GET /api/issuers/me`: Fetch current user's bound issuer profile.
* `PATCH /api/issuers/:id/approve`: Approve issuer accreditation profile and elevate user role to `ISSUER` (Admin only).
* `PATCH /api/issuers/:id/suspend`: Suspend issuer authority (Admin only).
* `PATCH /api/issuers/:id/revoke`: Revoke issuer profile and demote user role back to `USER` (Admin only).
* `POST /api/issuers/:id/rotate-key`: Generate new active keypair and transition current key to `RETIRED` (Admin only).

### Issuer Keys (`/api/issuer-keys`)
* `GET /api/issuer-keys`: List public cryptographic keys with status filtering.
* `GET /api/issuer-keys/:id`: Retrieve public key details by `keyId`.
* `PATCH /api/issuer-keys/:id/compromise`: Flag key as `COMPROMISED` with mandatory compromise timestamp.
* `PATCH /api/issuer-keys/:id/revoke`: Revoke keypair immediately.

### Documents (`/api/documents`)
* `POST /api/documents/upload`: Ingest `PDF`, `PNG`, or `JPG` file (10MB limit); validates magic bytes; calculates authoritative SHA-256; blocks executables; enforces directory boundary isolation.
* `GET /api/documents/:id`: Retrieve document metadata and SHA-256 hash (Admin, issuer, or uploader).
* `GET /api/documents/:id/download`: Stream exact byte-for-byte binary matching original hash.

### Credentials (`/api/credentials`)
* `POST /api/credentials/issue`: Issue v1 credential; validates issuer active status; canonicalizes payload via RFC 8785; signs with Ed25519 private key; records audit event.
* `GET /api/credentials`: List credentials with status, recipient, or issuer filtering.
* `GET /api/credentials/:id`: Retrieve credential with canonical payload, digital signature, and active version details.
* `GET /api/credentials/:id/versions`: Retrieve complete immutable version history.
* `POST /api/credentials/:id/versions`: Issue new revision (e.g. v2); preserves previous version as `SUPERSEDED`.
* `PATCH /api/credentials/:id/revoke`: Revoke credential with reason code and audit trail.
* `GET /api/credentials/:id/timeline`: Retrieve chronological lifecycle events and milestones.

### Verification (`/api/verifications`)
* `GET /api/verifications`: List recent verification reports.
* `POST /api/verifications/evaluate`: Execute 16-point verification engine across 6 trust levels (`UNKNOWN`, `SOURCE_FOUND`, `SOURCE_VERIFIED`, `INTEGRITY_VERIFIED`, `SIGNATURE_VERIFIED`, `CURRENTLY_VALID`). Enforces invariant that AI/OCR cannot override cryptographic failure.
* `POST /api/verifications/verify-source`: Query an accredited trusted source registry.
* `GET /api/verifications/:id`: Retrieve past verification record by ID.
* `GET /api/verifications/:id/evidence`: Fetch discrete historical evidence records for a verification.
* `POST /api/verifications/:id/manual-review`: Submit authorized human officer inspection (`ADMIN`, `AUDITOR`, `HR`).
* `GET /api/verifications/credential/:credentialId`: Retrieve verification history for a credential.

### Official Trusted Sources (`/api/trusted-sources`)
* `GET /api/trusted-sources`: List registered official verification portals and APIs.
* `GET /api/trusted-sources/:id`: Fetch source details and health status.
* `POST /api/trusted-sources`: Register a trusted source in `PENDING` state.
* `PATCH /api/trusted-sources/:id/approve`: Approve trusted source (Admin only).
* `PATCH /api/trusted-sources/:id/suspend`: Suspend source (Admin only).
* `PATCH /api/trusted-sources/:id/revoke`: Revoke source (Admin only).
* `POST /api/trusted-sources/:id/verify-domain`: Probe domain DNS and validate SSRF safety (blocks private/loopback/cloud metadata ranges).

### Document Analysis & OCR (`/api/analysis`)
* `POST /api/analysis/document`: Execute local AI heuristic classifier and anomaly detection.
* `POST /api/analysis/ocr`: Execute local Tesseract OCR extraction on document binary.
* `GET /api/analysis/:documentId`: Retrieve OCR text, structured tokens, and AI anomaly findings.

### Audit Chain (`/api/audit-logs`)
* `GET /api/audit-logs`: List paginated, immutable hash-linked audit entries (Admin and Auditor only).
* `GET /api/audit-logs/validate`: Run cryptographic chain traversal from genesis to head (`validateChain()`); detects content mutation, sequence deletion, or reordering.
* `POST /api/audit-logs/checkpoint`: Create a cryptographically linked periodic checkpoint.
* `GET /api/audit-logs/checkpoints`: List historical checkpoints.

### Notifications (`/api/notifications`)
* `GET /api/notifications`: Retrieve current user's notifications (supports `?unreadOnly=true`).
* `PATCH /api/notifications/read-all`: Mark all notifications as read.
* `PATCH /api/notifications/:id/read`: Mark single notification as read.
