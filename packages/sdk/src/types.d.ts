export type ProviderName = 'acurast' | 'fluence' | 'koii' | 'akash';
export type RuntimeType = 'nodejs' | 'python' | 'docker' | 'wasm';
export interface PhonixConfig {
    projectName: string;
    provider: ProviderName;
    runtime: RuntimeType;
    entryFile: string;
    schedule: ScheduleConfig;
    replicas?: number;
    maxCostPerExecution?: number;
    environment?: Record<string, string>;
    destinations?: string[];
}
export interface ScheduleConfig {
    type: 'onetime' | 'interval' | 'on-demand';
    intervalMs?: number;
    durationMs?: number;
}
export interface DeploymentConfig {
    runtime: RuntimeType;
    code: string;
    schedule: ScheduleConfig;
    replicas?: number;
    maxCostPerExecution?: number;
    environment?: Record<string, string>;
    destinations?: string[];
}
export interface Deployment {
    id: string;
    provider: ProviderName;
    status: 'pending' | 'live' | 'completed' | 'failed';
    processorIds: string[];
    createdAt: Date;
    url?: string;
}
export interface Message {
    from: string;
    payload: unknown;
    timestamp: Date;
    signature?: string;
}
export interface CostEstimate {
    provider: ProviderName;
    token: string;
    amount: number;
    usdEquivalent?: number;
}
export declare class PhonixError extends Error {
    constructor(providerOrMessage: string, message?: string);
}
export declare class ProviderNotImplementedError extends PhonixError {
    constructor(provider: ProviderName, method: string);
}
export declare class ConfigValidationError extends PhonixError {
    constructor(field: string, reason: string);
}
//# sourceMappingURL=types.d.ts.map