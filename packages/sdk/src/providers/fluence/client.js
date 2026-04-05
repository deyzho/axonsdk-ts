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
import { PhonixError } from '../../types.js';
// Default Fluence Kras relay (mainnet). Override via FLUENCE_RELAY_ADDR.
export const DEFAULT_FLUENCE_RELAY = '/dns4/kras-00.fluence.dev/tcp/19001/wss/p2p/12D3KooWSD5PToNiLQwKDXsu8JSysCwUt8BVUJEqCHcDe7P5h45e';
export class FluenceMessagingClient {
    relayAddr;
    peer = null;
    messageHandlers = [];
    connected = false;
    constructor(relayAddr = DEFAULT_FLUENCE_RELAY) {
        this.relayAddr = relayAddr;
    }
    async connect(secretKey) {
        // Dynamic import — @fluencelabs/js-client is optional
        let fluenceModule;
        try {
            fluenceModule = (await import('@fluencelabs/js-client'));
        }
        catch {
            throw new PhonixError('fluence', '@fluencelabs/js-client is not installed.\n' +
                'Install it with: npm install @fluencelabs/js-client');
        }
        // Derive a 32-byte Ed25519 seed from the hex secret key.
        // Enforce exactly 64 hex chars (32 bytes) — no silent truncation.
        const rawHex = secretKey.replace(/^0x/, '');
        if (rawHex.length !== 64) {
            throw new PhonixError('fluence', `FLUENCE_PRIVATE_KEY must be exactly 32 bytes (64 hex chars). Got ${rawHex.length} chars.\n` +
                'Run: phonix auth fluence  to generate a valid key.');
        }
        const keyBytes = hexToUint8Array(rawHex);
        const keyPair = await fluenceModule.KeyPair.fromEd25519SK(keyBytes);
        this.peer = await fluenceModule.Fluence.connect(this.relayAddr, { keyPair });
        this.connected = true;
    }
    disconnect() {
        if (this.peer && this.connected) {
            const peer = this.peer;
            peer.stop?.().catch(() => { });
            this.peer = null;
            this.connected = false;
        }
        // Always clear handlers — prevents stale callbacks firing on a reconnected
        // instance and avoids a reference leak if the caller drops the client object.
        this.messageHandlers = [];
    }
    async send(workerId, payload) {
        if (!this.peer || !this.connected) {
            throw new PhonixError('fluence', 'Not connected. Call connect() first.');
        }
        let callFunction;
        try {
            const mod = (await import('@fluencelabs/js-client'));
            callFunction = mod.callFunction;
        }
        catch {
            throw new PhonixError('fluence', '@fluencelabs/js-client is not installed.');
        }
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        // Call the `handleMessage` function on the deployed spell worker
        let result;
        try {
            result = await callFunction({
                peer: this.peer,
                // Standard Phonix spell function definition
                funcDef: {
                    name: 'handleMessage',
                    arrow: {
                        tag: 'arrow',
                        domain: {
                            tag: 'labeledProduct',
                            fields: { payload: { tag: 'scalar', name: 'string' } },
                        },
                        codomain: { tag: 'scalar', name: 'string' },
                    },
                    names: { relay: '-relay-', getDataSrv: '__getDataSrv', callbackSrv: '__callbackSrv', responseSrv: '__responseSrv', responseFnName: 'response', errorHandlingSrv: '__errorHandlingSrv', errorFnName: 'error' },
                },
                args: [payloadStr],
                config: {
                    ttl: 30_000,
                    // Route to the specific worker peer
                    relay: workerId,
                },
            });
        }
        catch (err) {
            throw new PhonixError('fluence', `Failed to call Fluence worker ${workerId}: ${err.message}`);
        }
        // Cap result size before parsing — a malicious peer could return a gigabyte
        // string that blocks the event loop in JSON.parse and exhausts heap memory.
        const MAX_RESULT_BYTES = 1 * 1024 * 1024; // 1 MiB
        if (result && typeof result === 'string' && result.trim()) {
            if (result.length > MAX_RESULT_BYTES) {
                throw new PhonixError('fluence', `Worker response exceeded maximum size of ${MAX_RESULT_BYTES} bytes (got ${result.length} bytes).`);
            }
            const msg = {
                from: workerId,
                payload: safeParseJson(result),
                timestamp: new Date(),
            };
            for (const handler of this.messageHandlers) {
                handler(msg);
            }
        }
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
        return () => {
            this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
        };
    }
    get isConnected() {
        return this.connected;
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function hexToUint8Array(hex) {
    const normalized = hex.length % 2 === 0 ? hex : '0' + hex;
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
        bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
    }
    // Pad or truncate to 32 bytes for Ed25519
    const result = new Uint8Array(32);
    result.set(bytes.slice(0, 32));
    return result;
}
/**
 * Parse JSON from an untrusted remote source.
 * Rejects payloads with prototype-polluting keys (__proto__, constructor, prototype)
 * to prevent Object.prototype pollution when the result is spread or assigned.
 */
function safeParseJson(str) {
    let parsed;
    try {
        parsed = JSON.parse(str);
    }
    catch {
        return str; // not JSON — return raw string
    }
    if (parsed !== null && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        for (const key of keys) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                throw new PhonixError('fluence', `Rejected remote payload: contains prototype-polluting key "${key}".`);
            }
        }
    }
    return parsed;
}
//# sourceMappingURL=client.js.map