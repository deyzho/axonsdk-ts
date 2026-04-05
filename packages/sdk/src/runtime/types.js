/**
 * IPhonixRuntime — provider-agnostic runtime interface for deployment scripts.
 *
 * Templates use `phonix.http.GET(...)` and `phonix.ws.open(...)` instead of
 * provider-specific globals like `_STD_`. At bundle time, the deployer prepends
 * a runtime bootstrap that maps `phonix` to the correct provider API.
 */
export {};
//# sourceMappingURL=types.js.map