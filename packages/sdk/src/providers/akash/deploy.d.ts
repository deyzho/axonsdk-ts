/**
 * Akash deployment helper.
 *
 * Flow:
 *  1. Bundle the user's entry file with esbuild (Akash runtime bootstrap prepended)
 *  2. Upload the bundle to IPFS → get CID
 *  3. Generate an SDL (Stack Definition Language) YAML that downloads the
 *     bundle from IPFS at container startup and runs it with Node.js
 *  4. Shell out to the `provider-services` CLI to create the deployment
 *  5. Parse the DSEQ (deployment sequence) and lease URL from CLI output
 *  6. Return a Deployment object
 *
 * SDL design:
 *  The generated SDL uses the official `node:20-alpine` image and a startup
 *  command that fetches the bundle from IPFS and runs it. This means the
 *  container does not need to be rebuilt when code changes — only the IPFS
 *  upload and a new deployment are required.
 *
 * Required credentials (in .env):
 *   AKASH_MNEMONIC       — 12 or 24-word BIP-39 mnemonic for the Akash wallet
 *   AKASH_IPFS_URL       — IPFS API endpoint for uploading bundles
 *   AKASH_IPFS_API_KEY   — IPFS API key
 *   AKASH_NODE           — Akash RPC node (optional, defaults to mainnet)
 *   AKASH_NET            — mainnet | testnet (optional, defaults to mainnet)
 */
import type { DeploymentConfig, Deployment } from '../../types.js';
/**
 * Generate an Akash SDL (Stack Definition Language) YAML for a Phonix deployment.
 *
 * The container downloads the bundle from IPFS at startup using wget and runs
 * it with Node.js. Environment variables are injected via the SDL env block.
 *
 * Resources are kept minimal for cost efficiency; increase via replicas or
 * a custom SDL for production workloads.
 */
export declare function generateAkashSdl(options: {
    bundleCid: string;
    environment?: Record<string, string>;
    replicas?: number;
    maxUaktPerBlock?: number;
    projectName?: string;
}): string;
export interface AkashDeployOptions {
    config: DeploymentConfig;
    cwd?: string;
    mnemonic?: string;
    ipfsUrl?: string;
    ipfsApiKey?: string;
    akashNode?: string;
    keyName?: string;
}
export declare function akashDeploy(options: AkashDeployOptions): Promise<Deployment>;
export declare function akashEstimate(config: DeploymentConfig): Promise<number>;
export declare function akashListDeployments(mnemonic?: string): Promise<Array<{
    id: string;
    processorIds: string[];
    status: string;
}>>;
//# sourceMappingURL=deploy.d.ts.map