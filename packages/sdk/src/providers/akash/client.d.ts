/**
 * AkashMessagingClient — HTTP-based messaging with Akash container deployments.
 *
 * Akash workloads run as Docker containers. Phonix containers expose a small
 * HTTP API on their lease URL:
 *
 *   GET  /health   → liveness probe (returns 200 "ok")
 *   POST /message  → deliver a payload; response body is the result
 *
 * The `processorId` for Akash is the full lease endpoint URL, e.g.:
 *   https://provider.akash.network:31234
 *
 * Security:
 *  - Only https:// endpoints are permitted (enforced in assertSafeAkashEndpoint)
 *  - Private/internal IP ranges are blocked (prevents SSRF)
 *  - Response bodies are capped at 1 MiB
 *  - Prototype-polluting keys in remote JSON payloads are rejected
 */
import type { Message } from '../../types.js';
export declare class AkashMessagingClient {
    private messageHandlers;
    private connected;
    connect(_secretKey: string): Promise<void>;
    disconnect(): void;
    /**
     * Send a payload to a deployed Akash container and dispatch the result to
     * registered message handlers.
     *
     * @param leaseEndpoint — full https:// URL of the lease (e.g. https://provider.akash.network:31234)
     * @param payload       — JSON-serialisable data
     */
    send(leaseEndpoint: string, payload: unknown): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
    /**
     * Probe the container's /health endpoint to confirm it is live.
     * Returns true if the container responds with 200, false otherwise.
     */
    isLive(leaseEndpoint: string): Promise<boolean>;
    get isConnected(): boolean;
}
//# sourceMappingURL=client.d.ts.map