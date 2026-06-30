import { describe, it, expect } from 'vitest';
import {
  PROVIDER_REGISTRY,
  providerTier,
  isSupported,
  isExperimental,
  SUPPORTED_PROVIDERS,
  DEPIN_PROVIDERS,
  CLOUD_PROVIDERS,
} from '../providers/registry.ts';
import type { ProviderName } from '../types.ts';

const ALL: ProviderName[] = [
  'acurast', 'ionet', 'akash', 'fluence', 'koii',
  'cloudflare', 'aws', 'gcp', 'azure', 'flyio',
];

describe('provider registry', () => {
  it('classifies every provider exactly once', () => {
    for (const name of ALL) {
      expect(PROVIDER_REGISTRY[name]).toBeDefined();
    }
    expect(Object.keys(PROVIDER_REGISTRY)).toHaveLength(ALL.length);
  });

  it('designates the supported set: acurast (anchor) + ionet + akash + cloudflare', () => {
    expect(PROVIDER_REGISTRY.acurast.support).toBe('anchor');
    expect(SUPPORTED_PROVIDERS.sort()).toEqual(['acurast', 'akash', 'cloudflare', 'ionet'].sort());
  });

  it('marks fluence, koii, aws, gcp, azure, flyio as experimental', () => {
    for (const name of ['fluence', 'koii', 'aws', 'gcp', 'azure', 'flyio'] as ProviderName[]) {
      expect(isExperimental(name)).toBe(true);
      expect(isSupported(name)).toBe(false);
    }
  });

  it('puts DePIN providers on the depin tier and clouds on the cloud tier', () => {
    expect(providerTier('acurast')).toBe('depin');
    expect(providerTier('ionet')).toBe('depin');
    expect(providerTier('cloudflare')).toBe('cloud');
    expect(providerTier('aws')).toBe('cloud');
  });

  it('DEPIN_PROVIDERS and CLOUD_PROVIDERS partition all providers', () => {
    expect([...DEPIN_PROVIDERS, ...CLOUD_PROVIDERS].sort()).toEqual([...ALL].sort());
    expect(DEPIN_PROVIDERS).toContain('akash');
    expect(CLOUD_PROVIDERS).toContain('flyio');
  });

  it('anchor and supported both count as supported', () => {
    expect(isSupported('acurast')).toBe(true); // anchor
    expect(isSupported('ionet')).toBe(true);   // supported
  });
});
