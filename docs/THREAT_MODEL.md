# SecureWork Verify — Security Threat Model (STRIDE Framework)

This document provides an exhaustive threat modeling analysis for the **SecureWork Verify** platform, following the Microsoft STRIDE methodology.

---

## 1. System Scope & Trust Boundaries

The system processes high-value workforce qualification records and digital evidence across four primary trust zones:

```
[Public Verifiers / ATS]  ──(Zone 1: Public / External)
           │
      HTTPS (TLS 1.3) + Rate Limiting
           ▼
[API Gateway / Express Service] ──(Zone 2: Platform Application Boundary)
      │               │
  RBAC + JCS      In-Process
      ▼               ▼
[Domain Services] ──► [Cryptographic Vault (keys/)] ──(Zone 3: Key Custody Isolation)
      │
 Mongoose / TLS
      ▼
[Database & Audit Log (MongoDB)] ──(Zone 4: Append-Only Hash Chain)
```

---

## 2. STRIDE Threat Analysis Matrix

| STRIDE Category | Threat Description | Vulnerability Surface | Implemented Mitigation & Cryptographic Defense | Residual Risk & Monitoring |
|---|---|---|---|---|
| **S — Spoofing** | Adversary attempts to forge credentials pretending to be an accredited institution (e.g. Stanford/MIT). | Credential issuance API (`POST /credentials/issue`) | **Asymmetric Digital Signatures (Ed25519)**: Signature is computed over RFC 8785 canonicalized payload using strictly isolated private keys. Mathematical verification fails if signed by an unauthorized key. | **Low**. Issuer key creation is restricted to approved institutions with Admin vetting. |
| **S — Spoofing** | Attacker spoofs verification requests or verifier identity. | B2B Verification Endpoint (`POST /v1/verify`) | **Hashed API Keys**: High-entropy `sk_live_` secrets hashed with SHA-256 in database; per-key rate limits and active status checks. | **Low**. API keys can be revoked immediately from management dashboard. |
| **T — Tampering** | Malicious actor modifies degree title, recipient name, or expiration date in stored credential. | MongoDB Credential storage (`credentials` collection) | **RFC 8785 Canonicalization & Signature Verification**: Any single-bit change in recipient, title, dates, or metadata produces signature verification failure upon verification. | **Zero**. Cryptographically impossible to alter without the private key. |
| **T — Tampering** | Attacker alters uploaded PDF document binary on disk or object storage. | File Storage (`storage/documents/` or Cloudinary) | **SHA-256 Digest Verification**: Authoritative SHA-256 calculated on ingest; re-hashed on download/verification to ensure bit-level integrity. | **Zero**. Corrupted document immediately fails verification. |
| **T — Tampering** | Attacker modifies or deletes past audit events in database. | `audit_logs` collection | **Cryptographic Hash-Linked Audit Chain**: Every audit event incorporates `previousHash` of preceding record. Any sequence gap, modification, or reordering breaks the chain. | **Zero**. Chain verification endpoint detects exact block tampered with. |
| **R — Repudiation** | An issuer revokes or claims they never issued a valid credential. | Credential Issuance Lifecycle | **Self-Contained Evidence Packages**: Signed evidence bundles with timestamped audit-log sequence number and issuer key certificate active at issuance time prove non-repudiation offline. | **Low**. Audit logs are append-only. |
| **I — Information Disclosure** | Recruiter or public visitor harvests sensitive PII (SSN, home address, private phone). | Public Verification Portal (`GET /public/verify/:id`) | **PII Redaction by Design**: Public portal only exposes qualification title, masked recipient name (e.g., `Alice J.`), issuer name, dates, and cryptographic proofs. | **Zero**. No unconsented PII is serialized in public view models. |
| **I — Information Disclosure** | Private keys leaked via logs, Git commits, or API responses. | `keys/` directory and serialization layers | **Strict Private Key Isolation**: Private keys stored in git-ignored vaults (`chmod 600`), never transmitted over REST interfaces, and sanitized from error responses. | **Zero**. Asserted by automated security test assertions. |
| **D — Denial of Service** | Volumetric traffic or computationally heavy signature brute-forcing. | Verification endpoints & Auth login | **Dual-Layer Rate Limiting**: Express rate limiters on auth (100 req/15min) and cryptographic evaluation (60 req/min). | **Low**. Protects CPU-intensive cryptographic routines. |
| **E — Elevation of Privilege** | Candidate or standard user accesses issuer key generation or admin audit inspection. | REST API Routes (`/issuers`, `/admin`, `/keys`) | **Multi-Tier RBAC**: Strict role checks (`ADMIN`, `ISSUER`, `HR`, `AUDITOR`, `USER`) validated at route middleware and domain service layer. | **Zero**. Unauthorized roles receive immediate 403 Forbidden. |

---

## 3. Cryptographic Invariants

1. **RFC 8785 Deterministic Canonicalization**: Key ordering, whitespace, and Unicode formatting are normalized prior to hashing and signing.
2. **Ed25519 Edwards-Curve Signatures**: Primary signature algorithm providing 128-bit security level, resistant to side-channel attacks.
3. **SHA-256 Digest Standard**: Applied uniformly across document payloads, audit chains, and API key indexing.
4. **Timing Attack Protection**: `crypto.timingSafeEqual` employed for all signature and hash byte comparisons.
