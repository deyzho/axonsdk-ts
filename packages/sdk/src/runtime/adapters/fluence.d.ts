/**
 * Fluence runtime bootstrap.
 *
 * Returns a JavaScript string prepended to bundles deployed to Fluence.
 * Fluence spells run in a JS environment with access to `fetch` and a
 * particle-based messaging context. This adapter maps `phonix` to that
 * environment.
 *
 * Messaging model:
 *   - ws.open() registers an incoming message handler; in Fluence, messages
 *     arrive via particle calls routed by the Aqua scheduler.
 *   - ws.send() stores the outgoing payload so the Aqua caller can read it
 *     as the function's return value via `globalThis.__phonixResult`.
 *   - The FluenceProvider's send() method calls the deployed spell function
 *     and reads `__phonixResult` from the return context.
 */
export declare function fluenceRuntimeBootstrap(): string;
//# sourceMappingURL=fluence.d.ts.map