/**
 * AcurastProvider — full v0.1 implementation of IPhonixProvider.
 *
 * Wires together:
 *  - AcurastMessagingClient (WebSocket auth + messaging via @acurast/dapp)
 *  - acurastDeploy / acurastEstimate / acurastListDeployments (CLI shell-outs)
 */
import { AcurastMessagingClient } from './client.js';
import { acurastDeploy, acurastEstimate, acurastListDeployments, } from './deploy.js';
export class AcurastProvider {
    name = 'acurast';
    messagingClient;
    wsUrl;
    constructor(wsUrl) {
        this.wsUrl = wsUrl ?? 'wss://ws-1.ws-server-1.acurast.com';
        this.messagingClient = new AcurastMessagingClient(this.wsUrl);
    }
    /**
     * Connect to the Acurast network using a P256 private key hex string.
     */
    async connect(secretKey) {
        await this.messagingClient.connect(secretKey);
    }
    /**
     * Disconnect from the Acurast WebSocket.
     */
    disconnect() {
        this.messagingClient.disconnect();
    }
    /**
     * Deploy a script to the Acurast network.
     * Bundles the entry file with esbuild and shells out to the acurast CLI.
     */
    async deploy(config) {
        return acurastDeploy({ config });
    }
    /**
     * Estimate the cost of a deployment in microACU.
     */
    async estimate(config) {
        const microAcu = await acurastEstimate(config);
        // Rough conversion: 1 ACU ≈ $0.01 USD (placeholder — replace with live price feed)
        const acu = microAcu / 1_000_000;
        const usdEquivalent = acu * 0.01;
        return {
            provider: 'acurast',
            token: 'ACU',
            amount: microAcu,
            usdEquivalent,
        };
    }
    /**
     * Return a list of all deployments owned by the current wallet.
     */
    async listDeployments() {
        const raw = await acurastListDeployments();
        return raw.map((d) => ({
            id: d.id,
            provider: 'acurast',
            status: d.status ?? 'pending',
            processorIds: d.processorIds,
            createdAt: new Date(),
            url: `https://${d.id}.acu.run`,
        }));
    }
    /**
     * Send a message to a specific Acurast processor node.
     * @param processorId — processor public key hex string
     * @param payload     — JSON-serialisable data
     */
    async send(processorId, payload) {
        if (!this.messagingClient.isConnected) {
            throw new Error('AcurastProvider is not connected. Call connect(secretKey) first.');
        }
        await this.messagingClient.send(processorId, payload);
    }
    /**
     * Register a handler for incoming messages from processors.
     * Returns an unsubscribe function.
     */
    onMessage(handler) {
        return this.messagingClient.onMessage(handler);
    }
}
//# sourceMappingURL=index.js.map