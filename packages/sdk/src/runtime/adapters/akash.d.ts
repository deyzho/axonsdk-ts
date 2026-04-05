/**
 * Akash runtime bootstrap.
 *
 * Akash containers run as standard Docker containers with Node.js. The phonix
 * runtime on Akash maps the provider-agnostic `phonix` API to:
 *
 *  - phonix.ws.open()   → starts an HTTP server on PORT (default 3000).
 *                         Messages arrive as POST /message; results are sent
 *                         back in the synchronous HTTP response.
 *  - phonix.ws.send()   → resolves the pending HTTP response with the payload.
 *  - phonix.http.GET/POST → Node.js global fetch (Node 18+).
 *  - phonix.fulfill()   → writes the result to stdout and resolves the response.
 *
 * The AkashMessagingClient (client-side SDK) communicates with deployed
 * containers by POSTing to their lease endpoint: POST /message.
 */
export declare function akashRuntimeBootstrap(): string;
//# sourceMappingURL=akash.d.ts.map