# Developer Demonstration Walkthrough

## Phase 0: Foundation Demonstration

This guide provides an end-to-end walkthrough for demonstrating the **Phase 0 Foundation** of SecureWork Verify.

---

## Step 1: Environment & Repository Verification

Run the automated verification script:

```bash
npm run verify
```

Expected Terminal Output:
```
==================================================
 SecureWork Verify — Foundation Verification Tool 
==================================================

🔍 [1/3] Verifying Directory & File Presence...
  ✅ All core files and boundaries verified successfully.
🔍 [2/3] Verifying Security .gitignore Configuration...
  ✅ Security exclusion rules verified for keys, documents, env, and node_modules.
🔍 [3/3] Verifying Backend In-Memory Lifecycle & Health Check...
  ✅ Backend server started and responded 200 OK.
  ✅ Health status: "healthy", uptime: 0s, DB: disconnected

==================================================
 🎉 Phase 0 Verification PASSED! Foundation is Ready.
==================================================
```

---

## Step 2: Launching Local Development Servers

Start both the backend and frontend concurrently:

```bash
npm run dev
```

* **Backend Output**: Express server starts listening on `http://localhost:5000`.
* **Frontend Output**: Vite development server starts on `http://localhost:5173`.

---

## Step 3: Interactive UI Demonstration

1. Open a browser and navigate to `http://localhost:5173`.
2. Observe the **SecureWork Verify Dashboard**:
   * **Real-time Backend Health Card**: Shows server uptime, memory usage, and Node version via live ping to `/api/health`.
   * **Persistence Layer Card**: Displays current MongoDB connection status with non-blocking standby mode.
   * **Zero-Cost Security Card**: Displays active cryptographic standards (Ed25519, SHA-256, RFC 8785 JCS).
   * **Modular Monolith Matrix**: Displays all 16 business domain modules and their designated phases.
3. Click the **"Ping Health"** button in the top navigation bar to trigger an active probe to the backend.
