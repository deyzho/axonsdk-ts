/**
 * Acurast messaging client — wraps @acurast/dapp AcurastClient.
 *
 * Handles:
 *  - P256 keypair generation / loading from hex secret key
 *  - WebSocket connection to the Acurast processor network
 *  - Message sending / receiving
 */
import type { Message } from '../../types.js';
/**
 * Generate a fresh P256 keypair.
 * Returns { secretKeyHex, publicKeyHex } where both values are hex-encoded raw bytes.
 */
export declare function generateP256KeyPair(): {
    secretKeyHex: string;
    publicKeyHex: string;
};
/**
 * AcurastMessagingClient wraps @acurast/dapp and exposes connect/disconnect/send/onMessage.
 */
export declare class AcurastMessagingClient {
    private acuClient;
    private messageHandlers;
    private publicKeyHex;
    private wsUrl;
    constructor(wsUrl?: string);
    /**
     * Connect to the Acurast WebSocket server using a P256 private key.
     * @param secretKeyHex — 32-byte P-256 private scalar as hex string
     */
    connect(secretKeyHex: string): Promise<void>;
    /** Close the WebSocket connection. */
    disconnect(): void;
    /**
     * Send a message to a processor identified by its public key (hex).
     * @param processorId — processor public key hex string
     * @param payload     — JSON-serialisable data (will be JSON.stringify'd if not string)
     */
    send(processorId: string, payload: unknown): Promise<void>;
    /**
     * Register a message handler.
     * @returns An unsubscribe function — call it to remove the handler.
     */
    onMessage(handler: (msg: Message) => void): () => void;
    /** The derived P-256 public key as a hex string. Available after connect(). */
    get publicKey(): string;
    /** Whether the client is currently connected. */
    get isConnected(): boolean;
}
//# sourceMappingURL=client.d.ts.map