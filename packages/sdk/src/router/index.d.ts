/**
 * Copyright (c) 2024–present Phonix. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This file contains trade secret algorithms that form the core of the Phonix
 * routing engine. Unauthorized copying, distribution, modification, reverse
 * engineering, or disclosure — in whole or in part — is strictly prohibited
 * without prior written consent from Phonix.
 *
 * For licensing enquiries contact: legal@phonix.dev
 */
import type { DeploymentConfig, Message } from '../types.js';
import type { RouterConfig, RouterDeployment, RouterSendOptions, ProviderHealthSnapshot, RouterEvent, RouterEventHandler } from './types.js';
export declare class PhonixRouter {
    private entries;
    private rrOrder;
    private rrProviderIndex;
    private readonly cfg;
    private eventHandlers;
    constructor(config: RouterConfig);
    connect(): Promise<void>;
    disconnect(): void;
    deploy(config: DeploymentConfig): Promise<RouterDeployment>;
    send(payload: unknown, options?: RouterSendOptions): Promise<void>;
    onMessage(handler: (msg: Message) => void): () => void;
    health(): ProviderHealthSnapshot[];
    onEvent(handler: RouterEventHandler): () => void;
    reset(): void;
    private _rankProviders;
    private _emit;
}
export type { RouterConfig, RouterDeployment, RouterSendOptions, ProviderHealthSnapshot, RouterEvent, RouterEventHandler };
//# sourceMappingURL=index.d.ts.map