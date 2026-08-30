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
      "timestamp": "2026-08-30T10:00:00.000Z"
    }
  }
  ```
* **Standard Error Envelope**:
  ```json
  {
    "success": false,
    "error": {
      "message": "Resource not found",
      "statusCode": 404,
      "timestamp": "2026-08-30T10:00:00.000Z"
    }
  }
  ```

---

## 2. Core Endpoints Overview

### System & Health
* `GET /api/health`: Service readiness, memory, uptime, and database connection status.
* `GET /api`: API version and documentation links.

### Authentication & Identity (Phase 1)
* `POST /api/auth/register`: Create user account (`ADMIN`, `ISSUER`, `VERIFIER`, `SUBJECT`).
* `POST /api/auth/login`: Authenticate and receive JWT access token.
* `POST /api/auth/logout`: Invalidate session.
* `GET /api/users/me`: Fetch authenticated user profile.

### Issuers & Key Management (Phase 1)
* `POST /api/issuers`: Register a new credential issuer.
* `GET /api/issuers/:id`: Retrieve issuer details and public keys.
* `POST /api/issuers/:id/keys`: Generate and publish a new asymmetric keypair.
* `POST /api/issuers/:id/keys/:keyId/revoke`: Revoke an issuer keypair.

### Credentials & Documents (Phase 2)
* `POST /api/credentials/issue`: Issue and digitally sign a verifiable credential.
* `GET /api/credentials/:id`: Retrieve credential record and cryptographic proof.
* `POST /api/credentials/:id/revoke`: Revoke credential and append to revocation registry.
* `POST /api/documents/upload`: Ingest qualification document and compute SHA-256 hash.

### Verification Engine (Phase 3)
* `POST /api/verification/verify`: Submit credential or proof package for full multi-phase verification.
* `POST /api/verification/verify-document`: Submit raw document hash and detached signature.
* `GET /api/verification/results/:id`: Retrieve complete verification report with evidence package.

### Audit Logs & Evidence (Phase 5)
* `GET /api/audit/trail/:resourceId`: Fetch historical tamper-evident event chain.
* `GET /api/audit/verify-chain`: Run cryptographic verification over the entire audit hash chain.
