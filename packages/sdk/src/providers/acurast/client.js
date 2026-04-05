/**
 * Acurast messaging client — wraps @acurast/dapp AcurastClient.
 *
 * Handles:
 *  - P256 keypair generation / loading from hex secret key
 *  - WebSocket connection to the Acurast processor network
 *  - Message sending / receiving
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
// Acurast WS endpoint
const ACURAST_WS_URL = 'wss://ws-1.ws-server-1.acurast.com';
/** Enforce that the WebSocket URL uses the secure wss:// scheme. */
function assertSecureWsUrl(url) {
    if (!url.startsWith('wss://')) {
        throw new Error(`WebSocket URL must use the wss:// scheme to protect key material in transit. ` +
            `Received: "${url}"`);
    }
}
// ─── Key utilities ────────────────────────────────────────────────────────────
/**
 * Convert a hex string to a Uint8Array.
 */
function hexToBytes(hex) {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length % 2 !== 0) {
        throw new Error('Invalid hex string — odd length');
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
/**
 * Build a minimal PKCS#8 DER for a raw 32-byte P-256 private key.
 *
 * The structure is:
 *   SEQUENCE {
 *     INTEGER 0                  (version)
 *     SEQUENCE {                 (AlgorithmIdentifier)
 *       OID 1.2.840.10045.2.1   (ecPublicKey)
 *       OID 1.2.840.10045.3.1.7 (P-256 / secp256r1)
 *     }
 *     OCTET STRING {             (privateKey)
 *       SEQUENCE {               (ECPrivateKey)
 *         INTEGER 1              (version)
 *         OCTET STRING <32 bytes>
 *       }
 *     }
 *   }
 *
 * Pre-computed header for a P-256 key without embedded public key (78 bytes total):
 *   30 4e                 SEQUENCE, 78 bytes
 *   02 01 00              INTEGER 0 (version)
 *   30 13                 SEQUENCE (AlgorithmIdentifier), 19 bytes
 *     06 07 2a 86 48 ce 3d 02 01   OID ecPublicKey
 *     06 08 2a 86 48 ce 3d 03 01 07  OID P-256
 *   04 34                 OCTET STRING, 52 bytes
 *     30 32               SEQUENCE (ECPrivateKey), 50 bytes
 *       02 01 01          INTEGER 1 (version)
 *       04 20             OCTET STRING, 32 bytes
 *       <32 bytes of private key>
 */
function buildPkcs8Der(rawKey) {
    const header = Buffer.from('304e020100301306072a8648ce3d020106082a8648ce3d030107043430320201010420', 'hex');
    return Buffer.concat([header, Buffer.from(rawKey)]);
}
/**
 * Derive the uncompressed P-256 public key (65 bytes) from a raw 32-byte private scalar.
 * Returns the public key as a Uint8Array (04 || X || Y).
 */
function derivePublicKey(secretKeyBytes) {
    const pkcs8Der = buildPkcs8Der(secretKeyBytes);
    const nodePrivKey = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });
    const nodePubKey = createPublicKey(nodePrivKey);
    const pubDer = Buffer.from(nodePubKey.export({ format: 'der', type: 'spki' }));
    // SPKI DER for P-256: 26-byte header + 65-byte uncompressed point (04 || X || Y)
    return new Uint8Array(pubDer.slice(pubDer.length - 65));
}
// ─── Key generation ───────────────────────────────────────────────────────────
/**
 * Generate a fresh P256 keypair.
 * Returns { secretKeyHex, publicKeyHex } where both values are hex-encoded raw bytes.
 */
export function generateP256KeyPair() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
    });
    // Extract raw 32-byte private scalar from PKCS#8 DER
    const privDer = Buffer.from(privateKey.export({ format: 'der', type: 'pkcs8' }));
    // Find "04 20" marker in ECPrivateKey OCTET STRING → raw key follows
    let rawPrivOffset = -1;
    for (let i = 0; i < privDer.length - 33; i++) {
        if (privDer[i] === 0x04 && privDer[i + 1] === 0x20) {
            rawPrivOffset = i + 2;
            break;
        }
    }
    if (rawPrivOffset === -1) {
        throw new Error('Failed to extract raw private key from DER');
    }
    const rawPriv = privDer.slice(rawPrivOffset, rawPrivOffset + 32);
    // Extract raw 65-byte uncompressed public key from SPKI DER
    const pubDer = Buffer.from(publicKey.export({ format: 'der', type: 'spki' }));
    const rawPub = pubDer.slice(pubDer.length - 65);
    return {
        secretKeyHex: rawPriv.toString('hex'),
        publicKeyHex: rawPub.toString('hex'),
    };
}
// ─── AcurastMessagingClient ───────────────────────────────────────────────────
/**
 * AcurastMessagingClient wraps @acurast/dapp and exposes connect/disconnect/send/onMessage.
 */
export class AcurastMessagingClient {
    acuClient = null;
    messageHandlers = new Set();
    publicKeyHex = '';
    wsUrl;
    constructor(wsUrl = ACURAST_WS_URL) {
        assertSecureWsUrl(wsUrl);
        this.wsUrl = wsUrl;
    }
    /**
     * Connect to the Acurast WebSocket server using a P256 private key.
     * @param secretKeyHex — 32-byte P-256 private scalar as hex string
     */
    async connect(secretKeyHex) {
        // Dynamic import — avoids breaking if @acurast/dapp is not installed at dev time
        let AcurastClient;
        try {
            const mod = await import('@acurast/dapp');
            // Handle various export shapes (@acurast/dapp may use default or named export)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modAny = mod;
            AcurastClient =
                modAny.AcurastClient ??
                    modAny.default?.AcurastClient ??
                    modAny.default;
            if (typeof AcurastClient !== 'function') {
                throw new Error('AcurastClient constructor not found in @acurast/dapp exports');
            }
        }
        catch (err) {
            throw new Error(`Failed to import @acurast/dapp — make sure it is installed:\n  npm install @acurast/dapp\n\nOriginal error: ${err.message}`);
        }
        // Derive keypair from raw secret key
        const secretKeyBytes = hexToBytes(secretKeyHex);
        const publicKeyBytes = derivePublicKey(secretKeyBytes);
        this.publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');
        const keyPair = {
            secretKey: secretKeyBytes,
            publicKey: publicKeyBytes,
        };
        this.acuClient = new AcurastClient(this.wsUrl);
        // Wire up the message dispatch before calling start()
        this.acuClient.onMessage = (sender, payload) => {
            const msg = {
                from: sender,
                payload: (() => {
                    try {
                        return JSON.parse(payload);
                    }
                    catch {
                        return payload;
                    }
                })(),
                timestamp: new Date(),
            };
            for (const handler of this.messageHandlers) {
                handler(msg);
            }
        };
        await this.acuClient.start(keyPair);
        // Zero the private key bytes now that start() has consumed them.
        // Minimises the window during which raw key material sits in heap memory.
        secretKeyBytes.fill(0);
    }
    /** Close the WebSocket connection. */
    disconnect() {
        if (this.acuClient) {
            this.acuClient.close();
            this.acuClient = null;
        }
    }
    /**
     * Send a message to a processor identified by its public key (hex).
     * @param processorId — processor public key hex string
     * @param payload     — JSON-serialisable data (will be JSON.stringify'd if not string)
     */
    async send(processorId, payload) {
        if (!this.acuClient) {
            throw new Error('AcurastMessagingClient is not connected — call connect() first');
        }
        const serialised = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await this.acuClient.send(processorId, serialised);
    }
    /**
     * Register a message handler.
     * @returns An unsubscribe function — call it to remove the handler.
     */
    onMessage(handler) {
        this.messageHandlers.add(handler);
        return () => {
            this.messageHandlers.delete(handler);
        };
    }
    /** The derived P-256 public key as a hex string. Available after connect(). */
    get publicKey() {
        return this.publicKeyHex;
    }
    /** Whether the client is currently connected. */
    get isConnected() {
        return this.acuClient !== null;
    }
}
//# sourceMappingURL=client.js.map