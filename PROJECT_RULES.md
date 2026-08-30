# SecureWork Verify — Engineering Rules & Architectural Principles

This document defines the non-negotiable architectural, security, and engineering rules governing the **SecureWork Verify** platform. Every module, pull request, and design decision must strictly adhere to these rules.

---

## 1. Evidence First Principle

* **No Unbacked Claims**: A credential, verification check, or qualification status must never transition to `VERIFIED` without verifiable, tamper-evident cryptographic or documentary evidence.
* **Evidence Envelope**: Every verification result must encapsulate a complete Evidence Package containing:
  1. The canonical representation of the verified credential or document.
  2. The exact cryptographic proof (digital signature, cryptographic hash, Merkle path).
  3. The identifier of the issuer and the exact public key certificate active at the time of signing.
  4. Precise timestamp and audit trail record ID.
* **Non-Repudiation**: Evidence packages must be self-contained so that third-party verifiers can independently validate the signature offline without calling back to the original issuer.

---

## 2. Cryptographic Verification Rules

* **Asymmetric Key Standards**:
  * Digital signatures must utilize modern, cryptographically secure algorithms: **Ed25519** (Edwards-curve Digital Signature Algorithm) as primary, with **ECDSA** (P-256) and **RSA** (minimum 2048-bit, 4096-bit recommended) supported for legacy enterprise compatibility.
  * Hashing must exclusively use **SHA-256** or **SHA-512**. MD5 and SHA-1 are strictly prohibited.
* **Deterministic Canonicalization**:
  * Before signing or computing hashes over JSON structures, data must be canonicalized using **RFC 8785 (JSON Canonicalization Scheme - JCS)** to guarantee consistent hashing regardless of key ordering or whitespace.
* **Signature Verification Pipeline**:
  * A signature is valid **only if**:
    1. The signature verifies mathematically against the issuer's registered public key.
    2. The issuer's status is active and untrusted/revocation flags are false.
    3. The public key was valid and not expired at the credential issuance timestamp.
    4. The credential identifier does not exist in the issuer's revocation registry.
* **Zero Trust Offline Verification**:
  * Verification logic must be deterministic and capable of running offline when provided with the credential and public key registry.

---

## 3. AI / OCR Limitations and Boundaries

* **Advisory Only**: AI and OCR outputs are strictly **advisory and supplementary**. They must NEVER be treated as conclusive cryptographic proof.
* **Human-in-the-Loop & Confidence Scores**:
  * OCR extracted fields must retain confidence scores (0.0 to 1.0) and bounding box telemetry.
  * Automated verification pipelines cannot issue a definitive verification decision if OCR confidence falls below the strict system threshold (0.85). Low confidence flags the item for human supervisor review.
* **No Black-Box Verifications**:
  * Verification decisions must be explainable. If AI heuristics flag potential document tampering (e.g., font inconsistencies, edge artifacts, metadata discrepancies), the system records an explicit anomaly report rather than silently accepting or rejecting.

---

## 4. Private-Key Protection & Custody

* **Strict Isolation**: Private keys must never be committed to source control, transmitted over any network interface, logged, or serialized into API responses.
* **Filesystem & Vault Protection**:
  * Private keys are stored in `backend/keys/` with strict OS-level permissions (e.g., `chmod 600` on POSIX systems).
  * Storage paths for private keys must be ignored by version control via `.gitignore`.
* **Zero API Key Leakage**:
  * No REST endpoint or GraphQL resolver may ever return a private key attribute.
  * Unit and integration tests must employ automated security assertions verifying that private key fields are omitted from all serialization layers.

---

## 5. No Paid Dependencies & Zero-Cost Principle

* **Open-Source & Native Tooling**:
  * The entire core architecture must be 100% operational on open-source, zero-cost components.
  * Use native Node.js `crypto` APIs rather than third-party proprietary cryptographic SaaS.
  * Use local file storage adapters for development, with modular abstraction for optional S3-compatible open object storage (e.g., MinIO) for self-hosted production.
  * OCR must use open-source engines (e.g., Tesseract.js / native Tesseract binaries) without paid cloud vision APIs (e.g., Google Cloud Vision, AWS Textract).
* **No Vendor Lock-In**:
  * Core interfaces (Storage, OCR, Notifications, Crypto) must use clean adapter patterns so that external infrastructure can be swapped without modifying domain services.

---

## 6. No Blockchain & No Fake External APIs

* **Pragmatic Cryptography Over Blockchain**:
  * Do not use blockchain, smart contracts, Web3 libraries, or distributed ledgers.
  * Trust is established through proven, high-performance, energy-efficient public-key infrastructure (PKI), digital signatures, and cryptographic Merkle audit logs. This guarantees millisecond verification speeds, zero gas fees, and privacy compliance (GDPR right to be forgotten).
* **No Fake or Incomplete Mocks**:
  * External integrations (e.g., official registry lookups) must not be simulated with hardcoded, fake API endpoints that pretend to work.
  * Instead, implement explicit **Adapter Interfaces** with:
    1. A strictly typed interface contract.
    2. A verifiable Local Mock Adapter for offline/testing development with clear synthetic datasets.
    3. An integration driver for verified open registries where available.

---

## 7. Role-Based Access Control (RBAC) & Security

* **Actor Roles**:
  * **System Admin (`ADMIN`)**: Platform configuration, issuer onboarding approval, audit log inspection.
  * **Credential Issuer (`ISSUER`)**: Authorized institution/employer that registers public keys, defines credential schemas, issues signed credentials, and manages revocations.
  * **Verifier (`VERIFIER`)**: Employer or third-party auditing entity that submits credentials for cryptographic and official source verification.
  * **Credential Subject / Worker (`SUBJECT`)**: Individual worker/professional who owns, views, and shares their credential portfolio.
* **Least Privilege Enforcement**:
  * Access control checks must be enforced at the API gateway/route level and asserted again within domain service methods.
  * Issuers cannot revoke credentials issued by other issuers.
  * Subjects can only view their own personal records and audit trails.
* **Defensive Security Standards**:
  * Input sanitization and schema validation on all inputs (JSON Schema / Joi / Zod).
  * Timing-attack resistant comparisons (`crypto.timingSafeEqual`) for all signature and hash comparisons.
  * Security headers via Helmet, sanitized error stacks in production, and strict CORS policies.

---

## 8. Historical Evidence Preservation & Tamper-Evident Audit Trails

* **Append-Only Immutability**:
  * Audit log entries must be strictly append-only. Updates (`UPDATE`) and deletions (`DELETE`) on audit trail records are strictly disallowed.
* **Hash-Linked Audit Chain**:
  * Each audit event must incorporate:
    * Monotonically increasing sequence number.
    * UTC ISO-8601 timestamp.
    * Actor ID and role.
    * Action type and target resource.
    * SHA-256 hash of the previous audit entry (`prevHash`), forming a tamper-evident cryptographic hash chain.
* **Storage Integrity**:
  * Uploaded source documents must have their cryptographic hash (SHA-256) calculated immediately upon ingestion and persisted immutably with the document record. Any subsequent bit rot or tampering will invalidate the document verification.

---

## 9. Modular Monolith Architecture & Microservices Migration

* **In-Process Boundary Discipline**:
  * Modules communicate via direct, typed service interfaces rather than raw database cross-queries or informal shared state.
  * Avoid tight coupling between modules (e.g., `verification.service` calls `issuerKey.service` and `trust.service` through defined interfaces).
* **Prepared for Microservices**:
  * Each module encapsulates its domain models, services, and business rules so that in the future, it can be extracted into an independent microservice behind an API gateway with zero domain rewrite.
