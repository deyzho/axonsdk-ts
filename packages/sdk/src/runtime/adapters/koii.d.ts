/**
 * Koii runtime bootstrap.
 *
 * Returns a JavaScript string prepended to bundles deployed to Koii.
 * Koii tasks run in a Node.js environment with `namespaceWrapper` available
 * globally. This adapter maps `phonix` to that environment.
 *
 * Messaging model:
 *   - ws.open() registers a message handler; messages arrive via the
 *     KoiiProvider calling the task's exported `handleMessage` function.
 *   - ws.send() stores the response in `globalThis.__phonixResult`, which
 *     KoiiProvider reads after calling the task entry.
 *   - http.GET/POST use Node.js fetch (available in Node 18+).
 */
export declare function koiiRuntimeBootstrap(): string;
//# sourceMappingURL=koii.d.ts.map