# screen-share-sdk

TypeScript SDK for screen sharing via WebRTC + SignalR. Works in React and Vanilla JS. SignalR is bundled automatically — no extra installation needed.

## Installation

```bash
npm install screen-share-sdk
# or
yarn add screen-share-sdk
```

> React is an optional peer dependency. If it's in your project, `ScreenShareButton` and `useScreenShare` are available. Otherwise use `createScreenShareButton` or `ScreenShareModal`.

### Local development (without npm publish)

```bash
# in the sdk folder — start watch mode
npm run dev

# in your project
npm install ../path/to/screen-share-sdk
```

For live reload without manual rebuilding, add to `next.config.js`:

```js
const nextConfig = {
  webpack: (config) => {
    config.watchOptions = { ...config.watchOptions, followSymlinks: true };
    return config;
  },
  transpilePackages: ['screen-share-sdk'],
};
```

---

## Quick start

### React

```tsx
import { ScreenShareButton } from 'screen-share-sdk';

function App() {
  return (
    <ScreenShareButton
      label="Share screen"
      config={{
        testMode: true, // ← remove for production
        onSessionStart: (id) => console.log('Session started:', id),
        onSessionEnd: (reason) => console.log('Session ended:', reason),
      }}
    />
  );
}
```

### Vanilla JS

```js
import { createScreenShareButton } from 'screen-share-sdk';

createScreenShareButton({
  container: '#toolbar',
  config: { testMode: true },
});
```

---

## Themes (dark / light mode)

SDK supports four modes via the `themeMode` prop (React) or option (Vanilla JS).

| Value | Behaviour |
|---|---|
| `"auto"` | Follows system/browser preference via `prefers-color-scheme`. **Default.** |
| `"dark"` | Always dark, regardless of system |
| `"light"` | Always light, regardless of system |
| `"custom"` | Controlled programmatically via `setThemeMode()` or `useThemeMode()` |

### Auto (default)

```tsx
// React
<ScreenShareButton /> // = themeMode="auto"

// Vanilla JS
createScreenShareButton({ container: '#btn' }) // = themeMode: 'auto'
```

### Fixed dark / light

```tsx
// React
<ScreenShareButton themeMode="dark" />
<ScreenShareButton themeMode="light" />

// Vanilla JS
createScreenShareButton({ container: '#btn', themeMode: 'dark' });
createScreenShareButton({ container: '#btn', themeMode: 'light' });
```

### Custom — React

Use the `useThemeMode` hook — returns the current theme and a setter that propagates changes to all active overlays at once.

```tsx
import { useThemeMode, ScreenShareButton } from 'screen-share-sdk';

function App() {
  const [theme, setTheme] = useThemeMode('dark'); // initial value

  return (
    <>
      <ScreenShareButton themeMode="custom" />

      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        Toggle theme
      </button>
    </>
  );
}
```

If your theme lives in external state (Redux, Zustand, Context…), call `setThemeMode` directly:

```tsx
import { setThemeMode, ScreenShareButton } from 'screen-share-sdk';

// Anywhere in the app — React state or event handler
setThemeMode('light');

// The component just declares it wants custom control
<ScreenShareButton themeMode="custom" />
```

### Custom — Vanilla JS

```js
import { setThemeMode, createScreenShareButton } from 'screen-share-sdk';

createScreenShareButton({ container: '#btn', themeMode: 'custom' });

// Toggle at any time — affects all open overlays immediately
document.getElementById('toggle').addEventListener('click', () => {
  setThemeMode('light');
});
```

`setThemeMode` works globally — including direct use of `ScreenShareModal` or `ScreenViewModal`:

```js
import { setThemeMode, ScreenShareModal } from 'screen-share-sdk';

const modal = new ScreenShareModal({ themeMode: 'custom' });
modal.open();

setThemeMode('light'); // updates the open modal immediately
```

---

## Configuration (`ScreenShareConfig`)

| Property | Type | Default | Description |
|---|---|---|---|
| `testMode` | `boolean` | `true` | Simulates a connection, no backend or SignalR needed |
| `testModeDelay` | `number` | `1500` | Simulated connection delay in ms |
| `hubUrl` | `string` | — | SignalR hub URL (required when `testMode: false`) |
| `iceServers` | `RTCIceServer[]` | Google STUN | STUN/TURN servers for WebRTC (see below) |
| `videoQuality` | see below | `"medium"` | Resolution and FPS of the outgoing video |
| `displaySurface` | see below | `"browser"` | What the user can share — tab / window / monitor / anything |
| `currentTab` | see below | auto | Overrides automatic tab-capture mode detection |
| `onSessionStart` | `(id: string) => void` | — | Called when the session is successfully established |
| `onSessionEnd` | `(reason) => void` | — | Called when sharing ends |
| `onError` | `(err) => void` | — | Error callback |

### Video quality (`videoQuality`)

Controls the resolution and FPS of the stream sent over WebRTC. Defaults to `"medium"` (1280×720 @ 15 fps).

| Preset | Resolution | FPS | Typical use |
|---|---|---|---|
| `"low"` | 854×480 | 10 | Slow networks, low-end clients |
| `"medium"` | 1280×720 | 15 | **Default** — good balance |
| `"high"` | 1920×1080 | 30 | Fast LAN / powerful hardware |
| `"source"` | native | native | No constraints (may be 2K/4K) |

```js
// Preset
config: { videoQuality: 'low' }
config: { videoQuality: 'high' }

// Custom values — all optional
config: {
  videoQuality: { width: 1920, height: 1080, frameRate: 24 }
}

// FPS only, no resolution constraint
config: {
  videoQuality: { frameRate: 20 }
}
```

> Values are passed as `{ ideal, max }` constraints to `getDisplayMedia` — the browser tries to honour them, but the actual resolution may also depend on system capabilities, especially when sharing a full screen or window.

### ICE servers — STUN / TURN (`iceServers`)

By default the SDK uses Google's public STUN server. For production or private networks, pass your own servers — no SDK rebuild required.

```js
config: {
  hubUrl: 'https://your-api.com/hubs/screenshare',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.your-server.com:3478',
      username: 'user',
      credential: 'password',
    },
  ],
}
```

> `iceServers` is configured identically for the sharing side (`ScreenShareConfig`) and the viewing side (`ViewerConfig`). Both session managers default to Google STUN if nothing is specified.

### Display surface (`displaySurface`)

Controls what the browser offers the user in the picker. Works as a hint — browsers honour it to varying degrees (Chrome typically respects it well, Firefox/Safari less so).

| Value | What the user sees in the picker | Chrome `preferCurrentTab` logic |
|---|---|---|
| `"browser"` | Browser tabs only. **Default.** | Active — Chrome skips the picker |
| `"window"` | Application windows | Ignored |
| `"monitor"` | Full screen | Ignored |
| `"any"` | Everything — tabs, windows, monitors | Ignored |

```js
// Let the user pick anything
config: { displaySurface: 'any', ... }

// Full screen only
config: { displaySurface: 'monitor', ... }

// Application windows only
config: { displaySurface: 'window', ... }

// Default — tabs only, Chrome skips the picker
config: { displaySurface: 'browser', ... } // or omit
```

> As soon as you set anything other than `"browser"`, the `currentTab` optimisation (see below) is automatically ignored — the user always sees the standard picker regardless of browser.

### Current tab support (`currentTab`)

The SDK auto-detects what the browser supports and picks the best available method. Manual override is possible via `config.currentTab`. Only applies when `displaySurface` is `"browser"` (or not set).

| Browser | Auto-detection | Behaviour |
|---|---|---|
| Chrome / Edge 94+ | `preferCurrentTab` | Picker is skipped, tab is captured immediately |
| Firefox 116+ | `selfBrowserSurface` | Current tab appears in the picker |
| Safari / older FF | `manual` | Standard picker, tab not in the list — user must pick another surface |
| Mobile / old browser | `unsupported` | Alert with explanation, sharing is not possible |

Manual override values:

```ts
config: {
  currentTab: 'preferCurrentTab'   // force Chrome behaviour
  currentTab: 'selfBrowserSurface' // show tab in picker
  currentTab: 'manual'             // standard picker
  currentTab: 'none'               // alias for manual
}
```

> **Safari and manual mode:** The current tab cannot appear in Safari's picker — this is an intentional Apple limitation. The user must share the full screen or another window.

---

## User flow

```
1.  Button click
     ├─ Chrome/Edge → browser immediately requests permission (no "Select screen" button)
     └─ other       → "Select screen" button is shown

2.  Permission denied?
     └─ explanation + "Try again" button shown (modal stays open)

3.  User enters the 6-digit agent code
     └─ code is remembered — pre-filled on next open

4.  Click "Connect"
     └─ SignalR joinSession(code) → server returns sessionId
     └─ WebRTC: createOffer → sendOffer → receives answer
     └─ modal closes automatically, sharing begins

5.  Click the button while sharing is active
     └─ control panel opens (live preview, Switch / Stop buttons)

6.  Switch screen ("Switch")
     └─ new picker → replaceTrack() → SignalR/WebRTC connection stays alive

7.  End sharing
     ├─ "Stop" button in the modal
     ├─ browser's native "Stop sharing" bar
     └─ agent disconnects → onSessionEnd callback
```

---

## API Reference

### `<ScreenShareButton>` (React)

Main component — includes the trigger button and the full modal flow.

```tsx
<ScreenShareButton
  label="Share screen"          // trigger button text
  className="my-btn"            // extra CSS class for the trigger
  style={{ borderRadius: 8 }}   // inline styles for the trigger
  config={sdkConfig}
  connection={existingHubConn}  // pass an existing SignalR HubConnection
>
  {/* optional render prop for a custom trigger element */}
  {({ onClick, isSharing }) => (
    <MyButton onClick={onClick} active={isSharing} />
  )}
</ScreenShareButton>
```

### `<ScreenViewButton>` (React)

Viewer-side equivalent of `ScreenShareButton` — generates a code, waits for a client to connect, and displays the incoming stream.

```tsx
<ScreenViewButton
  label="View screen"
  config={viewerConfig}
  connection={existingHubConn}
>
  {({ onClick, isViewing }) => (
    <MyButton onClick={onClick} active={isViewing} />
  )}
</ScreenViewButton>
```

### `useScreenShare(config?, connection?)` (React hook)

For custom UI — gives full control over state.

```tsx
const { state, requestScreen, startSession, stopSession } = useScreenShare(config);

// state.status: 'idle' | 'requesting_screen' | 'preview' | 'connecting' | 'sharing' | 'error'
// state.stream: MediaStream | null
// state.session: ScreenShareSession | null
// state.error: ScreenShareError | null
```

### `useScreenView(config?, connection?)` (React hook)

```tsx
const { state, register, startViewing, stopViewing } = useScreenView(config);

// state.status: 'idle' | 'registering' | 'waiting' | 'connecting' | 'viewing' | 'error'
// state.code: string | null
// state.stream: MediaStream | null
// state.error: ScreenShareError | null
```

### `createScreenShareButton(opts)` (Vanilla JS)

```js
const btn = createScreenShareButton({
  container: '#toolbar',    // CSS selector or HTMLElement
  label: 'Share screen',
  className: 'my-class',
  style: { borderRadius: '8px' },
  config: sdkConfig,
  connection: existingConnection,
});
// → returns HTMLButtonElement
```

### `createScreenViewButton(opts)` (Vanilla JS)

```js
const btn = createScreenViewButton({
  container: '#toolbar',
  label: 'View screen',
  config: viewerConfig,
  connection: existingConnection,
});
// → returns HTMLButtonElement
```

### `ScreenShareModal` (Vanilla JS — direct modal control)

```js
import { ScreenShareModal } from 'screen-share-sdk';

const modal = new ScreenShareModal({
  config: { testMode: true },
  onClose: () => {},
  onSessionStart: (id) => {},
  onSessionEnd: (reason) => {},
});

modal.open();
modal.close();
```

### `ScreenShareSessionManager` (advanced usage)

```js
import { ScreenShareSessionManager } from 'screen-share-sdk';

const manager = new ScreenShareSessionManager({
  testMode: false,
  hubUrl: '/hubs/screenshare',
});

// Detect browser support
const mode = manager.getEffectiveMode();
// → 'preferCurrentTab' | 'selfBrowserSurface' | 'manual' | 'unsupported'

// Capture the screen (respects detected mode)
const stream = await manager.requestScreen();

// Start the session
const session = await manager.startSession(stream, '123456');

// Switch the stream without interrupting the connection
const newStream = await manager.requestScreen();
await manager.replaceVideoTrack(newStream.getVideoTracks()[0]);

// Stop
session.stop();
```

### `detectCurrentTabSupport()` (utility)

```ts
import { detectCurrentTabSupport } from 'screen-share-sdk';

const support = detectCurrentTabSupport();
// → 'preferCurrentTab' | 'selfBrowserSurface' | 'manual' | 'unsupported'

if (support === 'manual') {
  // show the user a hint on how to select the right window
}

if (support === 'unsupported') {
  // hide the share button entirely
}
```

---

## Test mode

Code `000000` always simulates an error (invalid code) — for testing the error state.
Any other 6-digit code simulates a successful connection.

```js
config: {
  testMode: true,
  testModeDelay: 2000, // how long the "connecting" phase takes in ms
}
```

---

## Production deployment

```js
config: {
  testMode: false,
  hubUrl: 'https://your-api.com/hubs/screenshare',
  onSessionStart: (sessionId) => analytics.track('share_started', { sessionId }),
  onSessionEnd: (reason) => analytics.track('share_ended', { reason }),
}
```

### Passing an existing SignalR connection

If your app already has an open SignalR connection, the SDK can reuse it instead of opening a new one:

```ts
import * as signalR from '@microsoft/signalr';
import { ScreenShareButton } from 'screen-share-sdk';

const conn = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/app')
  .build();
await conn.start();

// SDK will use this connection
<ScreenShareButton connection={conn} config={{ hubUrl: '/hubs/app' }} />
```

### Expected SignalR methods on the server

| Method (invoke) | Parameters | Returns |
|---|---|---|
| `JoinSession` | `code: string` | `{ sessionId: string }` |
| `SendOffer` | `sessionId: string, offerJson: string` | — |
| `SendCandidate` | `sessionId: string, candidateJson: string` | — |

| Event (on) | Data |
|---|---|
| `ReceiveAnswer` | `answerJson: string` |
| `ReceiveCandidate` | `candidateJson: string` |
