// ─── Error types ────────────────────────────────────────────────────────────
export class PhonixError extends Error {
    constructor(providerOrMessage, message) {
        super(message ? `[${providerOrMessage}] ${message}` : providerOrMessage);
        this.name = 'PhonixError';
        // Maintain proper prototype chain in ES5 transpilation targets
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ProviderNotImplementedError extends PhonixError {
    constructor(provider, method) {
        super(`Provider '${provider}' has not implemented '${method}' yet. Coming in v0.2.`);
        this.name = 'ProviderNotImplementedError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ConfigValidationError extends PhonixError {
    constructor(field, reason) {
        super(`Invalid phonix.json — field '${field}': ${reason}`);
        this.name = 'ConfigValidationError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
//# sourceMappingURL=types.js.map