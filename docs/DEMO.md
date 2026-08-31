# SecureWork Verify — End-to-End System Demonstration Guide

This guide details the complete local demonstration tooling and end-to-end workflow for **SecureWork Verify**. 

In strict compliance with the architecture rules:
- **No external institutional or government responses are fabricated**.
- **No mock cryptographic signatures** are created.
- Official source verification queries rely strictly on controlled, local seeded registry adapters (`LocalSourceVerificationAdapter`).
- All cryptographic operations execute via native Node.js primitives (`crypto`, Ed25519, SHA-256).
- The demonstration runs entirely locally with zero external network dependencies or paid APIs.

---

## 1. Environment Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB Community Server**: Running locally on `127.0.0.1:27017`

### Setup Steps

1. **Clone and Install Dependencies**:
   ```bash
   git clone <repo-url> SecureWork_Verify
   cd SecureWork_Verify
   npm install
   ```

2. **Verify Environment Variables**:
   Confirm that `.env` exists at repository root and/or `backend/.env`. Key development values:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/securework_verify
   JWT_SECRET=dev_jwt_secret_min_32_characters_long_12345
   JWT_EXPIRES_IN=1h
   STORAGE_DRIVER=local
   UPLOAD_DIR=./uploads
   KEYS_DIR=./keys
   LOG_LEVEL=INFO
   ```

3. **Verify Local MongoDB Process**:
   Ensure `mongod` is active on port 27017:
   ```bash
   mongod --dbpath "$env:TEMP\mongo_test_db" --port 27017 --bind_ip 127.0.0.1
   ```

---

## 2. Seed Process

### Seeding Administrators
Administrator accounts can never be created via public self-service registration endpoints. Run the seed script:

```bash
npm run seed:admin --workspace=backend
```

**What the Seed Process Does**:
- Connects to local MongoDB.
- Checks if an `ADMIN` role account exists. If not, hashes `AdminSecurePass123!` with bcrypt (work factor 10) and creates `admin@securework.local` (`status: ACTIVE`).
- Generates an immutable hash-chained audit log entry for the administrative action.

### Seeding Development Demonstration Data
The demonstration tool automatically provisions scoped, local actor accounts, organizations, keys, and trusted registry entries during execution without manual database manipulation.

---

## 3. Demo Commands

Run the full automated demonstration covering all 17 scenarios:

```bash
# Run from repository root
npm run demo

# Or run directly from backend workspace
npm run demo --workspace=backend

# Or invoke directly with Node
node backend/src/scripts/demo.js
```

To run individual automated tests:
```bash
npm test
```

---

## 4. Complete Demonstration Matrix (Scenarios 1 to 17)

Below is the exhaustive scenario-by-scenario breakdown documenting the action, setup, expected result, and actual verified result:

| Demo # | Scenario Title | Action Performed | Expected Result | Actual Verified Result |
|:---:|---|---|---|---|
| **DEMO 1** | **Create Trusted Organization** | Admin registers institution `Camford University` and validates accreditation board evidence. | Organization state `ACTIVE` with verification status `VERIFIED`. | Organization `org_...` created with status `ACTIVE`, verificationStatus `VERIFIED`. Audit sequence recorded. |
| **DEMO 2** | **Create Issuer Request** | User `Dr. Katherine Bell` submits an issuer accreditation request bound to the verified organization. | Issuer profile created in `PENDING` state; awaiting Admin authorization. | Profile `iss_...` registered; status `PENDING`. User role remains `USER`. |
| **DEMO 3** | **ADMIN Approves Issuer** | Administrator reviews appointment gazette evidence and issues formal approval. | Issuer status becomes `ACTIVE`; candidate user role elevated to `ISSUER`. | Issuer status transitioned to `ACTIVE`. User promoted from `USER` to `ISSUER`. |
| **DEMO 4** | **Issuer Receives Ed25519 Keypair** | Platform generates native Ed25519 keypair for approved issuer. | Public key stored in MongoDB; private key written exclusively to disk with `0600` permissions. Zero private key DB leakage. | Key `key_...` created (`ED25519`). Private key saved in `backend/keys/<keyId>.key`. MongoDB field `privateKey` is `undefined`. |
| **DEMO 5** | **Issuer Issues Credential** | Issuer ingests degree PDF (`%PDF-1.5`), builds 9-field RFC 8785 canonical payload, and signs with Ed25519 private key. | Canonical payload serialized, Ed25519 digital signature created, v1 credential saved. | Document SHA-256 computed. Credential `crd_...` issued with cryptographic signature and canonical payload. |
| **DEMO 6** | **USER Uploads Exact Original** | Verifier uploads the exact byte-for-byte original PDF document and evaluates verification. | **`VERIFIED`** (Level 5 `CURRENTLY_VALID`). | Result: `VERIFIED`. Trust Level: `LEVEL 5 CURRENTLY_VALID`. Cryptographic status: `PASSED`. |
| **DEMO 7** | **Modify One Character (Tamper Detection)** | Adversary alters 1 byte ('Jane Doe' -> 'Lane Doe') and verifier submits the modified file. | **`ALTERED`** / `NOT_FOUND` (Document integrity failure). | Result: `ALTERED`. Trust Level: `LEVEL 2 SOURCE_VERIFIED`. Document integrity check: `FAILED`. |
| **DEMO 8** | **Revoke Credential** | Admin/Issuer revokes credential with recorded reason (disciplinary breach). Verifier re-evaluates. | **`CREDENTIAL_REVOKED`** (Level 4 `SIGNATURE_VERIFIED`). | Result: `CREDENTIAL_REVOKED`. Trust Level: `LEVEL 4 SIGNATURE_VERIFIED`. Digital signature remains historically valid. |
| **DEMO 9** | **Expire Credential** | Issuer issues credential with expiration 1 hour in the past. Verifier evaluates status. | **`CREDENTIAL_EXPIRED`** (Level 4 `SIGNATURE_VERIFIED`, not labeled fake). | Result: `CREDENTIAL_EXPIRED`. Trust Level: `LEVEL 4 SIGNATURE_VERIFIED`. Expiration check: `FAILED`. |
| **DEMO 10** | **Compromise Signing Key** | Issuer key is flagged `COMPROMISED` with date set prior to credential issuance. | **`KEY_COMPROMISED`** (Level 3 `INTEGRITY_VERIFIED`). | Result: `KEY_COMPROMISED`. Trust Level: `LEVEL 3 INTEGRITY_VERIFIED`. Credential issuance rejected due to compromised key state. |
| **DEMO 11** | **Upload Screenshot / Scan** | User uploads mobile camera photograph or scan of document instead of original digital PDF. | **`NOT_EXACT_FILE_MATCH`** (Caveat issued; requires manual review). | Result: `NOT_EXACT_FILE_MATCH`. Trust Level: `LEVEL 2 SOURCE_VERIFIED`. Explanation warns that scan cannot be verified bit-for-bit. |
| **DEMO 12** | **Official Source Without Cryptographic Signature** | Query official government database registry that confirms record exists without digital signature. | **`SOURCE FOUND / NOT CRYPTOGRAPHICALLY VERIFIED`**. | Source State: `SOURCE_FOUND`. Verified: `true`. Cryptographic proof: `NONE (Database entry only)`. |
| **DEMO 13** | **Official Source With Cryptographic Proof** | Query official registry returning cryptographically signed digital confirmation. | **`SOURCE_VERIFIED`**. | Source State: `SOURCE_VERIFIED`. Verified: `true`. Response SHA-256 digest recorded. |
| **DEMO 14** | **AI Detects Suspicious Formatting** | Verifier submits document with high-risk AI heuristic anomaly flags alongside valid cryptographic signature. | **`VERIFIED`** with advisory warnings. AI cannot override cryptographic proof. | Result: `VERIFIED`. Warnings include AI tampering flags. AI recorded as supplementary evidence without overriding valid signature. |
| **DEMO 15** | **OCR Extracts Document Fields** | Local Tesseract OCR processes sample certificate image and extracts structured text. | OCR extracts text and structured fields without modifying original document bytes. | Status: `SUCCESS`. Confidence score calculated. Raw characters and structured tokens extracted. Original hash untouched. |
| **DEMO 16** | **Two Sources Disagree (Conflicting Evidence)** | Verification engine receives valid cryptographic signature, but OCR text claims an entirely different institution/degree. | **`CONFLICTING_EVIDENCE`** (Level 3 `INTEGRITY_VERIFIED`). | Result: `CONFLICTING_EVIDENCE`. Trust Level: `LEVEL 3 INTEGRITY_VERIFIED`. Engine flags discrepancy between registry and OCR evidence. |
| **DEMO 17** | **Audit Record Tampering Detection** | Adversary directly mutates an arbitrary MongoDB audit entry. Auditor triggers `validateChain()`. | **`TAMPERING DETECTED`** (Identifies exact sequence and mismatched hash). | Re-validation state: `TAMPERING DETECTED`. Sequence number and mismatching SHA-256 hash printed. Chain restored cleanly. |

---

## 5. Typical Output Snapshot

When running `npm run demo`, terminal output confirms execution through each scenario:

```text
======================================================================
  SECUREWORK VERIFY — COMPLETE END-TO-END DEMONSTRATION
  Phase 17 Verification & Demonstration Suite
======================================================================
[INFO] MongoDB connection established: 127.0.0.1/securework_verify

======================================================================
  DEMO 1: Create Trusted Organization
======================================================================
Organization Created: Camford University of Technology (org_33ab1ea3e8b2fc2f)
Official Domain:       camford_1788168763663.ac.uk
Status:                ACTIVE
Verification Status:   VERIFIED

======================================================================
  DEMO 2: Create Issuer Request
======================================================================
Issuer Profile Registered: DEAN_ENG_1788168763663 (iss_222832364b354d77)
Organization Bound:        org_33ab1ea3e8b2fc2f
Initial Status:            PENDING (Strictly awaiting Admin approval)

======================================================================
  DEMO 3: ADMIN Approves Issuer
======================================================================
Issuer Status: ACTIVE
Approved By:   usr_d2b67d3dc119b5ee
Promoted Role: ISSUER (Elevated from USER -> ISSUER)

======================================================================
  DEMO 4: Issuer Receives Ed25519 Cryptographic Keypair
======================================================================
Key ID:         key_9c4f825fd52d1059
Algorithm:      ED25519
Status:         ACTIVE
Public Key:
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA9b7YJ5d535H1Gg0h+6o1qM5Y76wV...
-----END PUBLIC KEY-----
Private Key:    Stored securely on disk in backend/keys/key_9c4f825fd52d1059.key (0600)
MongoDB Leak:   CLEAN (Private key never stored in DB)

======================================================================
  DEMO 5: Issuer Issues Credential with Canonical Payload & Signature
======================================================================
Credential ID:      crd_cd2055338152310a
Version:            1 (ver_21fe4445fe7ea107)
Document SHA-256:   2bfb15b3ba1982b6833c8ffce30d970fa07c0eaeeebda10f089600a9435b71da
Canonical Payload:  { ... 9 sorted fields ... }
Digital Signature:  5yGZ...==
Status:             ACTIVE

======================================================================
  DEMO 6: Verifier / User Uploads Exact Original Document
======================================================================
Verification Result:  VERIFIED (Expected: VERIFIED)
Trust Level:          LEVEL 5 CURRENTLY_VALID (Level 5 CURRENTLY_VALID)
Cryptographic Status: PASSED

======================================================================
  DEMO 7: Tamper Detection (Modify Exactly One Character)
======================================================================
Original Hash:       2bfb15b3ba1982b6833c8ffce30d970fa07c0eaeeebda10f089600a9435b71da
Tampered Hash:       9c104e12cbf7dfa8114400e95a9d8fa176a9173f4e24faeb6b0cfce38b4fec21
Verification Result: ALTERED (Expected: ALTERED / NOT_FOUND)
Trust Level:         LEVEL 2 SOURCE_VERIFIED
Integrity Check:     FAILED

======================================================================
  DEMO 8: Revoke Credential
======================================================================
Verification Result:  CREDENTIAL_REVOKED (Expected: CREDENTIAL_REVOKED)
Trust Level:          LEVEL 4 SIGNATURE_VERIFIED (Level 4 SIGNATURE_VERIFIED)
Cryptographic Status: PASSED (Historical signature remains valid)

======================================================================
  DEMO 9: Expired Credential Evaluation
======================================================================
Verification Result:  CREDENTIAL_EXPIRED (Expected: CREDENTIAL_EXPIRED)
Trust Level:          LEVEL 4 SIGNATURE_VERIFIED (Level 4 SIGNATURE_VERIFIED)
Expiration Check:     FAILED

======================================================================
  DEMO 10: Compromise Signing Key (Backdated Before Issuance)
======================================================================
Key Status:          COMPROMISED (Compromised at: 2026-08-30T09:32:44.506Z)
Verification Result: KEY_COMPROMISED (Expected: KEY_COMPROMISED)
Trust Level:         LEVEL 3 INTEGRITY_VERIFIED

======================================================================
  DEMO 11: Upload Screenshot / Mobile Phone Scan
======================================================================
Representation Type: SCAN / SCREENSHOT
Verification Result: NOT_EXACT_FILE_MATCH (Expected: NOT_EXACT_FILE_MATCH)
Trust Level:         LEVEL 2 SOURCE_VERIFIED

======================================================================
  DEMO 12: Official Source Query Without Cryptographic Signature
======================================================================
Source Queried:      Higher Education Degree Verification Registry
Source State:        SOURCE_FOUND (SOURCE FOUND / NOT CRYPTOGRAPHICALLY VERIFIED)
Verified Status:     true
Cryptographic Proof: NONE (Database entry only)

======================================================================
  DEMO 13: Official Source Query With Cryptographic Proof
======================================================================
Source Queried:      Higher Education Degree Verification Registry
Source State:        SOURCE_VERIFIED (Expected: SOURCE_VERIFIED)
Response SHA-256:    fcb8ea772b2f90450769afc2d183f1f6b4543a33fe39d8e31a3c8991ebfe62f2
Notes:               Official cryptographic confirmation issued by Higher Education Degree Verification Registry

======================================================================
  DEMO 14: AI Heuristic Detection & Non-Override Enforcement
======================================================================
Digital Signature:    VALID
AI Tampering Flagged: SUSPICIOUS (HIGH RISK)
Verification Result:  VERIFIED
Warnings Issued:
 - AI analysis flagged potential document manipulation.
AI Authority Limit:   AI output recorded as advisory evidence; cryptographic truth is preserved.

======================================================================
  DEMO 15: OCR Text & Structured Field Extraction
======================================================================
Document ID:         doc_b600992334eb474a
OCR Engine Status:   SUCCESS
Confidence Score:    95.0%
Extracted Text Snippet:
HI

======================================================================
  DEMO 16: Conflicting Evidence Detection (OCR vs Registry Contradiction)
======================================================================
Verification Result: CONFLICTING_EVIDENCE (Expected: CONFLICTING_EVIDENCE)
Trust Level:         LEVEL 3 INTEGRITY_VERIFIED (Level 3 INTEGRITY_VERIFIED)
Conflict Check:      FLAGGED

======================================================================
  DEMO 17: Audit Chain Tampering Detection
======================================================================
Initial Chain State: CRYPTOGRAPHICALLY VALID
Total Audit Entries: 48
Adversary Action: Directly altered MongoDB audit record sequence #24
Re-Validation State: TAMPERING DETECTED (Expected: TAMPERING DETECTED)
Detected Errors:     1
  [Error 1] Sequence #24: INCORRECT_CURRENT_HASH -> Record #24 currentHash mismatch. Computed hash differs from stored hash. Record content was modified.

Chain Integrity Restored for repeatable demonstration runs.

======================================================================
  ALL 17 DEMO SCENARIOS COMPLETED SUCCESSFULLY!
======================================================================
```

---

## 6. Known Limitations

1. **Local OCR Character Recognition (Tesseract.js)**:
   - Tesseract.js running locally operates on bitmap image files (`image/png`, `image/jpeg`). Pure text PDF streams require rasterization before OCR extraction.
   - Low-resolution mobile screenshots or extreme camera rotation can reduce OCR confidence scores. OCR is purely advisory and never overrides cryptographic digests.
2. **Local AI Risk Classification**:
   - The local heuristic classifier relies on local statistical models and regex structural analysis (`FULL_LOCAL` mode) without querying proprietary external LLMs.
   - Anomaly detection checks formatting density, character distributions, and suspicious font changes, but does not claim deep semantic comprehension.
3. **In-Memory Rate Limiting**:
   - Rate limiting in development operates via an in-memory sliding window map. Multi-instance cluster scaling requires a shared Redis or Redis-compatible store.
4. **Key Custody**:
   - Private keys in the local environment are stored in filesystem directories (`backend/keys/`) with strict POSIX permissions (`0600`). In production cloud environments, a Hardware Security Module (HSM) or Key Management Service (KMS) adapter should be connected via the provided `KeyStorageAdapter` abstraction.
5. **No External Government API Mocking**:
   - To maintain cryptographic honesty, external government registries are only confirmed when an official source adapter is configured. Mocking or claiming real-world external government confirmation without verified endpoints is strictly prohibited.
