/**
 * KoiiMessagingClient — messaging with Koii task nodes.
 *
 * Koii task nodes expose an HTTP API (default port 10000). The `processorId`
 * for Koii is either:
 *   - A task node HTTP endpoint URL (e.g. "http://node.koii.com:10000")
 *   - A base58 public key (looked up via the K2 task registry)
 *
 * Message flow (send):
 *   1. POST the payload to `${nodeEndpoint}/task/${taskId}/input`
 *   2. Poll `${nodeEndpoint}/task/${taskId}/result` until the result appears
 *   3. Dispatch the result to registered message handlers
 *
 * Message flow (onMessage):
 *   Handlers are called whenever send() receives a response from a node.
 *   Koii does not support push-style messaging — all communication is
 *   request/response initiated by the client.
 */
import type { Message } from '../../types.js';
export declare class KoiiMessagingClient {
    private rpcUrl;
    private taskId;
    private messageHandlers;
    private connected;
    constructor(rpcUrl?: string);
    connect(secretKey: string, taskId?: string): Promise<void>;
    disconnect(): void;
    send(nodeEndpoint: string, payload: unknown): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
    get isConnected(): boolean;
    get koiiRpcUrl(): string;
}
//# sourceMappingURL=client.d.ts.map