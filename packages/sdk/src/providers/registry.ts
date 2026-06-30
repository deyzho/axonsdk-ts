/**
 * Copyright (c) 2024–present AxonSDK. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Provider tier registry — the single source of truth for AxonSDK's two-tier
 * routing model (see `docs/STRATEGY.md`).
 *
 *   Tier 1 — DePIN / edge / TEE  (the "spear"): routed to first.
 *   Tier 2 — cloud               (the "shield"): automatic fallback only.
 *
 * `support` records how production-hardened a provider is. Only the supported set
 * (`anchor` + `supported`) is part of the product surface; everything else is
 * `experimental` — usable, but explicitly not part of the headline two-tier model.
 */

import type { ProviderName } from '../types.js';

export type ProviderTier = 'depin' | 'cloud';

export type SupportStatus = 'anchor' | 'supported' | 'experimental';

export interface ProviderMeta {
  /** Which routing tier the provider belongs to. */
  tier: ProviderTier;
  /** How production-hardened the provider is within the strategy. */
  support: SupportStatus;
}

/**
 * Classification of every provider. The supported set is intentionally small:
 * Acurast (anchor) + io.net + Akash on the DePIN tier, Cloudflare as the single
 * cloud fallback. Everything else is `experimental`.
 */
export const PROVIDER_REGISTRY: Record<ProviderName, ProviderMeta> = {
  // ─── Tier 1 — DePIN (supported) ─────────────────────────────────────────────
  acurast:    { tier: 'depin', support: 'anchor' },
  ionet:      { tier: 'depin', support: 'supported' },
  akash:      { tier: 'depin', support: 'supported' },

  // ─── Tier 2 — cloud (supported fallback) ────────────────────────────────────
  cloudflare: { tier: 'cloud', support: 'supported' },

  // ─── Experimental — not part of the headline two-tier model ─────────────────
  fluence:    { tier: 'depin', support: 'experimental' },
  koii:       { tier: 'depin', support: 'experimental' },
  aws:        { tier: 'cloud', support: 'experimental' },
  gcp:        { tier: 'cloud', support: 'experimental' },
  azure:      { tier: 'cloud', support: 'experimental' },
  flyio:      { tier: 'cloud', support: 'experimental' },
};

/** The routing tier a provider belongs to. */
export function providerTier(name: ProviderName): ProviderTier {
  return PROVIDER_REGISTRY[name].tier;
}

/** Whether a provider is part of the supported set (anchor or supported). */
export function isSupported(name: ProviderName): boolean {
  return PROVIDER_REGISTRY[name].support !== 'experimental';
}

/** Whether a provider is experimental (not part of the headline product). */
export function isExperimental(name: ProviderName): boolean {
  return PROVIDER_REGISTRY[name].support === 'experimental';
}

const ALL_PROVIDERS = Object.keys(PROVIDER_REGISTRY) as ProviderName[];

/** Providers that are part of the supported set, in registry order. */
export const SUPPORTED_PROVIDERS: ProviderName[] = ALL_PROVIDERS.filter(isSupported);

/** All DePIN-tier providers (supported and experimental). */
export const DEPIN_PROVIDERS: ProviderName[] = ALL_PROVIDERS.filter(
  (n) => providerTier(n) === 'depin',
);

/** All cloud-tier providers (supported and experimental). */
export const CLOUD_PROVIDERS: ProviderName[] = ALL_PROVIDERS.filter(
  (n) => providerTier(n) === 'cloud',
);
