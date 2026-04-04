# Phonix Oracle Template

A data oracle that fetches external data, signs it with the processor's TEE keypair, and pushes it to configured destinations — running privately on Acurast smartphone nodes.

## What this does

- Fetches Bitcoin and Ethereum prices from CoinGecko every 60 seconds
- Signs the result inside the TEE (tamper-proof)
- Pushes the signed data to your configured destinations
- Verifiable on-chain — consumers can check the processor's signature

## Quick deploy

```bash
# 1. Copy this template
cp -r templates/oracle my-oracle
cd my-oracle

# 2. Configure your destination (e.g. a smart contract address)
# Edit phonix.json and add to "destinations": ["0xYourContractAddress"]

# 3. Set credentials
echo "ACURAST_MNEMONIC=your twelve word mnemonic here" >> .env

# 4. Deploy
phonix deploy
```

## Configuration

Edit `phonix.json`:

| Field | Default | Description |
|-------|---------|-------------|
| `schedule.intervalMs` | 60000 | Fetch interval (60 seconds) |
| `schedule.durationMs` | 2592000000 | Lifetime (30 days) |
| `destinations` | `[]` | Where to push results |

## Changing the data source

Edit `src/index.ts` and update the `PRICE_FEED_URL` constant:

```typescript
// Example: ETH gas price
const GAS_FEED_URL = 'https://api.etherscan.io/api?module=gastracker&action=gasoracle';

// Example: Weather data
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=48.8&longitude=2.3&current_weather=true';
```

## Reading the oracle data

### From a smart contract (Acurast Consumer Protocol)

See [Acurast Consumer documentation](https://docs.acurast.com/developers/substrate-consumer) for integrating the signed result into your contract.

### From a dApp

```typescript
import { PhonixClient } from '@phonix/sdk';

const client = new PhonixClient({ provider: 'acurast' });

client.onMessage((msg) => {
  const { btcUsd, ethUsd, timestamp } = msg.payload as {
    btcUsd: number;
    ethUsd: number;
    timestamp: number;
  };
  console.log(`BTC: $${btcUsd} | ETH: $${ethUsd} at ${new Date(timestamp).toISOString()}`);
});
```
