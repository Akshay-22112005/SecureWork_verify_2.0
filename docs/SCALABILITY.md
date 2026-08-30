# Scalability & Performance Specification

## 1. Architectural Scaling Strategy

The modular monolith is structured to scale horizontally across three evolution stages:

```mermaid
graph TD
    subgraph Stage1 [Stage 1: Modular Monolith]
        M1[Single Process Node.js]
        DB1[(Single MongoDB)]
    end

    subgraph Stage2 [Stage 2: Clustered Monolith + Background Queues]
        LB[Load Balancer]
        M2A[API Instance 1]
        M2B[API Instance 2]
        Redis[(Redis Queue)]
        Worker[Background OCR Worker]
        DB2[(MongoDB Primary + Replicas)]
    end

    subgraph Stage3 [Stage 3: Distributed Microservices]
        GW[API Gateway]
        SvcAuth[Auth & Issuer Service]
        SvcVerif[Verification Service]
        SvcOCR[OCR & ML Service]
    end

    Stage1 --> Stage2
    Stage2 --> Stage3
```

---

## 2. Stateless Core Verification

* **Sub-5ms Latency**: Cryptographic verification of Ed25519 signatures requires zero database writes and zero external network calls.
* **Public Key In-Memory Caching**: Active issuer public keys are cached in memory with a short TTL (e.g. 5 minutes) and cache-invalidation hooks on key revocation.
* **No Server Sessions**: All API authentication uses stateless JWTs, enabling round-robin load balancing across unlimited Node.js instances without sticky sessions.

---

## 3. High-Throughput Asynchronous Workers

Heavy compute tasks are offloaded from the main event loop:
* **OCR & Heuristic Image Processing**: When documents are uploaded, the API server saves the binary, computes the SHA-256 hash immediately, returns an ingestion ID, and offloads image processing to an asynchronous worker queue.
* **Batch Verification**: Enterprise verifiers submitting thousands of employee records for annual audit utilize a bulk verification worker pool.
