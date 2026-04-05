/**
 * Acurast runtime bootstrap.
 *
 * Returns a JavaScript string that is prepended to the deployment bundle.
 * It maps `globalThis.phonix` to the Acurast TEE's `_STD_` global,
 * providing a provider-agnostic interface to templates.
 *
 * Also keeps `_STD_` itself intact for backward compatibility with templates
 * that still reference it directly.
 */
export declare function acurastRuntimeBootstrap(): string;
//# sourceMappingURL=acurast.d.ts.map