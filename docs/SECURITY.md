# Security & Threat Model Specification

## 1. Threat Modeling (STRIDE Analysis)

| Threat | Threat Description | SecureWork Verify Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Adversary attempts to forge a credential issuer identity. | Asymmetric digital signatures (Ed25519) verified against accredited public keys. No credential accepted without mathematical signature proof. |
| **Tampering** | Modifying credential attributes (e.g. employee job title, dates). | Canonical JSON serialization (RFC 8785) and SHA-256 hash checking. Any byte modification invalidates the digital signature. |
| **Repudiation** | An issuer denies having issued an authentic credential. | Standalone Evidence Packages include detached digital signatures and immutable audit entries signed by the issuer key. |
| **Information Disclosure** | Unauthorized parties viewing personal credential data or private keys. | RBAC enforcement, zero private key serialization over APIs, strict filesystem permissions on `backend/keys/` (`chmod 600`). |
| **Denial of Service** | Flooding verification endpoints or database exhaustion. | Request rate limiting, payload size constraints (10MB default), fast offline signature verification (sub-5ms). |
| **Elevation of Privilege** | Normal user attempting to issue or revoke credentials. | Strict route-level and service-level RBAC role validation (`ADMIN`, `ISSUER`, `VERIFIER`, `SUBJECT`). |

---

## 2. Cryptographic Key Isolation

* **Isolated Custody**: Private keys reside strictly in `backend/keys/` and are never loaded into client bundles, passed to external APIs, or logged.
* **Separation of Roles**: Public keys are published in signed directory manifests. Private keys are accessed solely by backend signing subroutines.
* **Git Exclusions**: Version control `.gitignore` strictly rejects all `.pem`, `.key`, and private certificates.

---

## 3. Defensive Implementation Standards

1. **Timing Attack Protection**:
   * All signature, token, and hash verifications use constant-time comparisons (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
2. **HTTP Hardening**:
   * Helmet middleware configures secure HTTP headers (HSTS, Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).
3. **CORS Restrictions**:
   * Configurable whitelisting via environment variables. Wildcards (`*`) are disallowed in production deployments.
4. **Input Sanitization**:
   * Strict schema validation rejects unexpected attributes on all incoming payloads before processing.
