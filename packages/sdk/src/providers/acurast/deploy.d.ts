/**
 * Acurast deployment helper.
 *
 * Flow:
 *  1. Bundle the user's entry file with esbuild (single JS file, no external deps)
 *  2. Write the bundle to a temp file
 *  3. Shell out to the `acurast` CLI (from @acurast/cli) to deploy
 *  4. Parse the CLI output to extract deployment ID and processor pubkeys
 *  5. Return a Deployment object
 */
import type { DeploymentConfig, Deployment } from '../../types.js';
/**
 * Bundle an entry file to a single self-contained JS string using esbuild.
 *
 * The Acurast runtime bootstrap (`phonix` global mapping to `_STD_`) is
 * prepended to the output so deployment scripts can use either `phonix.*`
 * or `_STD_.*` at runtime.
 *
 * Environment variables from `phonix.json > environment` are injected via
 * esbuild's `define` so they are available as `process.env.KEY` in the bundle.
 */
export declare function bundleEntryFile(entryPath: string, environment?: Record<string, string>): Promise<string>;
export interface AcurastDeployOptions {
    config: DeploymentConfig;
    cwd?: string;
    mnemonic?: string;
    ipfsUrl?: string;
    ipfsApiKey?: string;
}
/**
 * Deploy a Phonix project to the Acurast network.
 */
export declare function acurastDeploy(options: AcurastDeployOptions): Promise<Deployment>;
/**
 * Estimate the cost of an Acurast deployment by calling `acurast estimate-fee`.
 * Falls back to a placeholder if the CLI is not available.
 */
export declare function acurastEstimate(config: DeploymentConfig): Promise<number>;
/**
 * List deployments by shelling out to `acurast deployments ls`.
 */
export declare function acurastListDeployments(mnemonic?: string): Promise<Array<{
    id: string;
    processorIds: string[];
    status: string;
}>>;
//# sourceMappingURL=deploy.d.ts.map