/**
 * Runtime bootstrap factory.
 *
 * Returns a JavaScript preamble string for a given provider target.
 * This preamble is prepended to deployment bundles so the `phonix` global
 * is available inside the deployment script at runtime.
 *
 * Usage (in provider deploy functions):
 *   const preamble = generateRuntimeBootstrap('acurast');
 *   const bundle = preamble + esbuildOutput;
 *
 * Usage (in run-local):
 *   const shim = generateRuntimeBootstrap('mock');
 *   // write to temp file and inject via node --import
 */
import type { ProviderName } from '../types.js';
export type RuntimeTarget = ProviderName | 'mock';
/**
 * Generate the runtime bootstrap JavaScript string for the given target.
 * The returned string should be prepended to (or injected before) the
 * deployment bundle so `globalThis.phonix` is defined before user code runs.
 */
export declare function generateRuntimeBootstrap(target: RuntimeTarget): string;
export type { IPhonixRuntime, PhonixRuntimeHttp, PhonixRuntimeWs } from './types.js';
//# sourceMappingURL=index.d.ts.map