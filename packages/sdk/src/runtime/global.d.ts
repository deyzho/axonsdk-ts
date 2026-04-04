/**
 * Ambient type declarations for the `phonix` global available inside
 * deployment scripts at runtime.
 *
 * Reference this in your deployment script's tsconfig.json:
 *   {
 *     "compilerOptions": {
 *       "types": ["@phonix/sdk/runtime/global"]
 *     }
 *   }
 *
 * Or add a triple-slash reference at the top of your script:
 *   /// <reference types="@phonix/sdk/dist/runtime/global" />
 */

import type { IPhonixRuntime } from './types.js';

declare global {
  /**
   * The Phonix runtime global — available inside deployment scripts.
   * Maps to the provider's native execution APIs at runtime.
   */
  const phonix: IPhonixRuntime;
}

export {};
