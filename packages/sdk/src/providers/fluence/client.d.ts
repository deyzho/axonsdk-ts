/**
 * FluenceMessagingClient — WebSocket-style messaging over the Fluence P2P network.
 *
 * Uses @fluencelabs/js-client to connect to a Fluence relay node and exchange
 * messages with deployed Fluence spells. The spell must expose a function
 * `handleMessage(payload: string) -> string` that the client can call.
 *
 * Message flow (send):
 *   1. Client calls the spell's handleMessage function via callFunction()
 *   2. The spell's phonix bootstrap receives the payload via __phonixDispatch()
 *   3. The script handles it and stores a result in globalThis.__phonixResult
 *   4. The Fluence spell returns __phonixResult to the caller
 *
 * Message flow (onMessage — receiving unsolicited messages):
 *   Not natively supported by Fluence; handlers registered here are invoked
 *   by send() when the spell returns a non-empty result.
 */
import type { Message } from '../../types.js';
export declare const DEFAULT_FLUENCE_RELAY = "/dns4/kras-00.fluence.dev/tcp/19001/wss/p2p/12D3KooWSD5PToNiLQwKDXsu8JSysCwUt8BVUJEqCHcDe7P5h45e";
export declare class FluenceMessagingClient {
    private relayAddr;
    private peer;
    private messageHandlers;
    private connected;
    constructor(relayAddr?: string);
    connect(secretKey: string): Promise<void>;
    disconnect(): void;
    send(workerId: string, payload: unknown): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
    get isConnected(): boolean;
}
//# sourceMappingURL=client.d.ts.map