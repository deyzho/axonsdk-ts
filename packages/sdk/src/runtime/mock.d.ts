/**
 * Mock runtime bootstrap for `phonix run-local`.
 *
 * Returns a JavaScript string that, when injected via `node --import`,
 * sets up both `globalThis.phonix` and `globalThis._STD_` (for backward
 * compatibility with templates that still reference _STD_ directly).
 *
 * The mock:
 *  - Simulates an immediate WebSocket connection and fires a test message
 *  - Performs real HTTPS requests for http.GET / http.POST (blocks private IPs)
 *  - Logs all operations to stdout for developer visibility
 */
export declare function mockRuntimeBootstrap(): string;
//# sourceMappingURL=mock.d.ts.map