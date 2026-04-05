# @phonixsdk/mobile

> React Native / Expo SDK for calling Phonix edge processors from iOS and Android apps.

[![npm](https://img.shields.io/npm/v/@phonixsdk/mobile)](https://www.npmjs.com/package/@phonixsdk/mobile)
[![license](https://img.shields.io/npm/l/@phonixsdk/mobile)](./LICENSE)

## Overview

`@phonixsdk/mobile` lets you call your deployed Phonix processors directly from iOS and Android apps. Deploy your processors with the Phonix CLI on your development machine, then call them from your mobile app using React hooks or the standalone client.

**Supports:** Akash Network (HTTP) · Acurast (WebSocket) · Generic HTTPS

## Installation

```bash
npm install @phonixsdk/mobile @phonixsdk/sdk
# optional: expo-secure-store for secure key storage
expo install expo-secure-store
```

## Quick start

### Context + hooks (recommended)

```tsx
import { PhonixProvider, usePhonixContext, useMessages, useSend } from '@phonixsdk/mobile';

// Wrap your app
export default function App() {
  return (
    <PhonixProvider provider="akash" secretKey={PHONIX_SECRET_KEY} autoConnect>
      <HomeScreen />
    </PhonixProvider>
  );
}

// Use in any screen
function HomeScreen() {
  const { client, connected } = usePhonixContext();
  const messages = useMessages(client);
  const { send, sending } = useSend(client);

  return (
    <>
      <Button
        title="Send"
        disabled={!connected || sending}
        onPress={() => send('https://your-lease.akash.network:31234', { prompt: 'Hello' })}
      />
      {messages.map((m, i) => (
        <Text key={i}>{JSON.stringify(m.payload)}</Text>
      ))}
    </>
  );
}
```

### Multi-provider router

Route across multiple DePIN networks with automatic failover and health scoring:

```tsx
import { usePhonixRouter } from '@phonixsdk/mobile';

function App() {
  const { router, connected, health } = usePhonixRouter({
    routes: [
      { provider: 'akash',   endpoint: 'https://lease.akash.example.com', secretKey },
      { provider: 'acurast', endpoint: 'wss://proxy.acurast.com',          secretKey },
    ],
    strategy: 'balanced',   // 'balanced' | 'latency' | 'availability' | 'cost' | 'round-robin'
    autoConnect: true,
  });

  return (
    <Button
      title="Send"
      disabled={!connected}
      onPress={() => router?.send({ prompt: 'Hello from iOS' })}
    />
  );
}
```

AppState listeners are attached automatically — the router pauses on background and resumes on foreground.

### Secure key storage

```tsx
import { SecureKeyStorage } from '@phonixsdk/mobile';

const storage = new SecureKeyStorage();
await storage.saveSecretKey(myKey);   // iOS Keychain / Android Keystore
const key = await storage.loadSecretKey();
```

## API

| Export | Description |
|---|---|
| `MobilePhonixClient` | Messaging-only client — connect, send, onMessage |
| `MobilePhonixRouter` | Multi-provider router with circuit breakers and health scoring |
| `usePhonix(options)` | Hook — manages client lifecycle |
| `usePhonixRouter(config)` | Hook — manages router lifecycle with AppState awareness |
| `useMessages(client)` | Hook — reactive `Message[]` array, newest first |
| `useSend(client)` | Hook — wraps `send()` with `sending` / `sendError` state |
| `PhonixProvider` | React context — provides client to your component tree |
| `usePhonixContext()` | Consumes the PhonixProvider context |
| `SecureKeyStorage` | iOS Keychain / Android Keystore via `expo-secure-store` |

## Documentation

Full docs at [phonix.dev](https://phonix.dev) · [GitHub](https://github.com/deyzho/phonixsdk)

## License

Apache-2.0 © [Phonix](https://phonix.dev)
