# screen-share-sdk

TypeScript SDK pro sdílení obrazovky přes WebRTC + SignalR. Funguje v React i Vanilla JS. SignalR se bundluje automaticky — dev nemusí nic instalovat navíc.

## Instalace

```bash
npm install screen-share-sdk
# nebo
yarn add screen-share-sdk
```

> React je volitelná peer dependency. Pokud ho máš v projektu, fungují `ScreenShareButton` a `useScreenShare`. Pokud ne, použij `createScreenShareButton` nebo `ScreenShareModal`.

### Lokální vývoj (bez npm publish)

```bash
# v sdk složce — spusť watch mode
npm run dev

# v tvém projektu
npm install ../cesta/k/screen-share-sdk
```

Pro live reload bez nutnosti ručně buildovat přidej do `next.config.js`:

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

## Rychlý start

### React

```tsx
import { ScreenShareButton } from 'screen-share-sdk';

function App() {
  return (
    <ScreenShareButton
      label="Sdílet obrazovku"
      config={{
        testMode: true, // ← odstraň pro produkci
        onSessionStart: (id) => console.log('Session zahájena:', id),
        onSessionEnd: (reason) => console.log('Session ukončena:', reason),
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

## Témata (dark / light mode)

SDK podporuje čtyři režimy přes prop `themeMode` (React) nebo option `themeMode` (Vanilla JS).

| Hodnota | Chování |
|---|---|
| `"auto"` | Sleduje systémové nastavení OS / browseru přes `prefers-color-scheme`. **Výchozí.** |
| `"dark"` | Vždy tmavé, bez ohledu na systém |
| `"light"` | Vždy světlé, bez ohledu na systém |
| `"custom"` | Ovládáš sám přes `setThemeMode()` nebo hook `useThemeMode()` |

### Auto (výchozí)

```tsx
// React
<ScreenShareButton /> // = themeMode="auto"

// Vanilla JS
createScreenShareButton({ container: '#btn' }) // = themeMode: 'auto'
```

### Dark / Light natvrdo

```tsx
// React
<ScreenShareButton themeMode="dark" />
<ScreenShareButton themeMode="light" />

// Vanilla JS
createScreenShareButton({ container: '#btn', themeMode: 'dark' });
createScreenShareButton({ container: '#btn', themeMode: 'light' });
```

### Custom — React

Použij hook `useThemeMode` — vrací aktuální téma a setter, který propaguje změnu do všech aktivních overlayů naráz.

```tsx
import { useThemeMode, ScreenShareButton } from 'screen-share-sdk';

function App() {
  const [theme, setTheme] = useThemeMode('dark'); // výchozí hodnota

  return (
    <>
      <ScreenShareButton themeMode="custom" />

      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        Přepnout téma
      </button>
    </>
  );
}
```

Pokud máš téma uložené ve vlastním stavu (Redux, Zustand, Context…), stačí volat `setThemeMode` přímo:

```tsx
import { setThemeMode, ScreenShareButton } from 'screen-share-sdk';

// Kdekoli v aplikaci — React state nebo event handler
setThemeMode('light');

// Komponenta jen oznamuje, že chce custom řízení
<ScreenShareButton themeMode="custom" />
```

### Custom — Vanilla JS

```js
import { setThemeMode, createScreenShareButton } from 'screen-share-sdk';

createScreenShareButton({ container: '#btn', themeMode: 'custom' });

// Přepnutí kdykoli — ovlivní všechny otevřené overlaye ihned
document.getElementById('toggle').addEventListener('click', () => {
  setThemeMode('light');
});
```

`setThemeMode` funguje globálně — i při přímém použití `ScreenShareModal` nebo `ScreenViewModal`:

```js
import { setThemeMode, ScreenShareModal } from 'screen-share-sdk';

const modal = new ScreenShareModal({ themeMode: 'custom' });
modal.open();

setThemeMode('light'); // změní téma otevřeného modalu okamžitě
```

---

## Konfigurace (`ScreenShareConfig`)

| Vlastnost | Typ | Výchozí | Popis |
|---|---|---|---|
| `testMode` | `boolean` | `true` | Simuluje spojení, nevyžaduje BE ani SignalR |
| `testModeDelay` | `number` | `1500` | Zpoždění simulace připojení v ms |
| `hubUrl` | `string` | — | URL SignalR hubu (nutné pokud `testMode: false`) |
| `iceServers` | `RTCIceServer[]` | Google STUN | STUN/TURN servery pro WebRTC (viz níže) |
| `displaySurface` | viz níže | `"browser"` | Co smí uživatel sdílet — tab / okno / monitor / cokoliv |
| `currentTab` | viz níže | auto | Přepíše automatickou detekci tab-capture módu |
| `onSessionStart` | `(id: string) => void` | — | Zavolá se při úspěšném připojení |
| `onSessionEnd` | `(reason) => void` | — | Zavolá se při ukončení sdílení |
| `onError` | `(err) => void` | — | Chybový callback |

### ICE servery — STUN / TURN (`iceServers`)

Ve výchozím stavu SDK používá Google's veřejný STUN server. Pro produkci nebo privátní sítě stačí předat vlastní servery — bez nutnosti rebuild SDK.

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

> `iceServers` se nastavuje identicky pro sdílecí stranu (`ScreenShareConfig`) i pro stranu zobrazující (`ViewerConfig`). Oba session managery se shodují na výchozím Google STUN pokud nic nenastavíš.

### Výběr sdíleného povrchu (`displaySurface`)

Řídí co browser nabídne uživateli v pickeru. Funguje jako hint — browser ho respektuje dle svých možností (Chrome ho typicky respektuje dobře, Firefox/Safari méně).

| Hodnota | Co uživatel vidí v pickeru | Chrome `preferCurrentTab` logika |
|---|---|---|
| `"browser"` | Pouze záložky prohlížeče. **Výchozí.** | Aktivní — Chrome přeskočí picker |
| `"window"` | Okna aplikací | Ignorována |
| `"monitor"` | Celá obrazovka PC | Ignorována |
| `"any"` | Vše — záložky, okna, monitory | Ignorována |

```js
// Chci aby user mohl vybrat cokoliv
config: { displaySurface: 'any', ... }

// Chci jen celé obrazovky
config: { displaySurface: 'monitor', ... }

// Chci jen okna aplikací
config: { displaySurface: 'window', ... }

// Výchozí — pouze záložky, Chrome přeskočí picker
config: { displaySurface: 'browser', ... } // nebo vynechat
```

> Jakmile nastavíš cokoliv jiného než `"browser"`, `currentTab` optimalizace (viz níže) se automaticky ignoruje — uživatel vždy uvidí standardní picker bez ohledu na browser.

### Podpora aktuálního tabu (`currentTab`)

SDK automaticky detekuje co browser umí a zvolí nejlepší dostupnou metodu. Ruční override je možný přes `config.currentTab`.

| Browser | Auto-detekce | Chování |
|---|---|---|
| Chrome / Edge 94+ | `preferCurrentTab` | Picker se přeskočí, tab se zachytí okamžitě |
| Firefox 116+ | `selfBrowserSurface` | Aktuální tab se zobrazí v pickeru |
| Safari / starší FF | `manual` | Standardní picker, tab není v nabídce — uživatel vybírá jiný povrch |
| Mobil / starý browser | `unsupported` | Alert s vysvětlením, sdílení není možné |

Možné hodnoty pro ruční override:

```ts
config: {
  currentTab: 'preferCurrentTab'   // vynutí Chrome chování
  currentTab: 'selfBrowserSurface' // tab se zobrazí v pickeru
  currentTab: 'manual'             // standardní picker
  currentTab: 'none'               // alias pro manual
}
```

> **Safari a manual mode:** Aktuální tab nelze v Safari zobrazit v pickeru — je to záměrná limitace Apple. Uživatel musí sdílet celou obrazovku nebo jiné okno.

---

## Uživatelský flow

```
1.  Kliknutí na tlačítko
     ├─ Chrome/Edge → browser rovnou žádá o povolení (bez tlačítka "Vybrat")
     └─ ostatní    → zobrazí se tlačítko "Vybrat obrazovku"

2.  Povolení zamítnuto?
     └─ zobrazí se vysvětlení + tlačítko "Zkusit znovu" (žádné zavírání modalu)

3.  Uživatel zadá 6-místný kód od agenta
     └─ kód se drží v paměti — při příštím otevření je předvyplněný

4.  Kliknutí na "Připojit"
     └─ SignalR joinSession(code) → server vrátí sessionId
     └─ WebRTC: createOffer → sendOffer → přijme answer
     └─ modal se automaticky zavře, sdílení začíná

5.  Kliknutí na tlačítko během aktivního sdílení
     └─ otevře se kontrolní panel (živý náhled, tlačítka Přepnout / Zastavit)

6.  Přepnutí obrazovky ("Přepnout")
     └─ nový picker → replaceTrack() → SignalR/WebRTC spojení zůstává

7.  Ukončení sdílení
     ├─ tlačítko "Zastavit" v modalu
     ├─ nativní lišta browseru "Přestáváte sdílet"
     └─ agent se odpojí → onSessionEnd callback
```

---

## API Reference

### `<ScreenShareButton>` (React)

Hlavní komponenta — obsahuje trigger tlačítko i celý modal flow.

```tsx
<ScreenShareButton
  label="Share screen"          // text výchozího tlačítka
  className="my-btn"            // extra CSS třída pro trigger
  style={{ borderRadius: 8 }}   // inline styly pro trigger
  config={sdkConfig}
  connection={existingHubConn}  // předání existujícího SignalR HubConnection
>
  {/* volitelný render prop pro vlastní trigger element */}
  {({ onClick, isSharing }) => (
    <MyButton onClick={onClick} active={isSharing} />
  )}
</ScreenShareButton>
```

### `useScreenShare(config?, connection?)` (React hook)

Pro vlastní UI — dává plnou kontrolu nad stavem.

```tsx
const { state, requestScreen, startSession, stopSession } = useScreenShare(config);

// state.status: 'idle' | 'requesting_screen' | 'preview' | 'connecting' | 'sharing' | 'error'
// state.stream: MediaStream | null
// state.session: ScreenShareSession | null
// state.error: ScreenShareError | null
```

### `createScreenShareButton(opts)` (Vanilla JS)

```js
const btn = createScreenShareButton({
  container: '#toolbar',    // CSS selektor nebo HTMLElement
  label: 'Share screen',
  className: 'my-class',
  style: { borderRadius: '8px' },
  config: sdkConfig,
  connection: existingConnection,
});
// → vrací HTMLButtonElement
```

### `ScreenShareModal` (Vanilla JS — přímá kontrola modalu)

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

### `ScreenShareSessionManager` (pokročilé použití)

```js
import { ScreenShareSessionManager } from 'screen-share-sdk';

const manager = new ScreenShareSessionManager({
  testMode: false,
  hubUrl: '/hubs/screenshare',
});

// Detekce podpory browseru
const mode = manager.getEffectiveMode();
// → 'preferCurrentTab' | 'selfBrowserSurface' | 'manual' | 'unsupported'

// Zachycení obrazovky (respektuje detekovaný mode)
const stream = await manager.requestScreen();

// Spuštění session
const session = await manager.startSession(stream, '123456');

// Přepnutí streamu bez přerušení spojení
const newStream = await manager.requestScreen();
await manager.replaceVideoTrack(newStream.getVideoTracks()[0]);

// Ukončení
session.stop();
```

### `detectCurrentTabSupport()` (utility)

```ts
import { detectCurrentTabSupport } from 'screen-share-sdk';

const support = detectCurrentTabSupport();
// → 'preferCurrentTab' | 'selfBrowserSurface' | 'manual' | 'unsupported'

if (support === 'manual') {
  // zobraz uživateli nápovědu jak vybrat správné okno
}

if (support === 'unsupported') {
  // skryj tlačítko sdílení úplně
}
```

---

## Test mode

Kód `000000` vždy simuluje chybu (neplatný kód) — pro testování error stavu.
Jakýkoliv jiný 6-místný kód simuluje úspěšné připojení.

```js
config: {
  testMode: true,
  testModeDelay: 2000, // jak dlouho "připojování" trvá v ms
}
```

---

## Produkční nasazení

```js
config: {
  testMode: false,
  hubUrl: 'https://your-api.com/hubs/screenshare',
  onSessionStart: (sessionId) => analytics.track('share_started', { sessionId }),
  onSessionEnd: (reason) => analytics.track('share_ended', { reason }),
}
```

### Předání existujícího SignalR spojení

Pokud máš v aplikaci již otevřené SignalR spojení, SDK ho může sdílet místo otevírání nového:

```ts
import * as signalR from '@microsoft/signalr';
import { ScreenShareButton } from 'screen-share-sdk';

const conn = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/app')
  .build();
await conn.start();

// SDK použije toto spojení
<ScreenShareButton connection={conn} config={{ hubUrl: '/hubs/app' }} />
```

### Očekávané SignalR metody na serveru

| Metoda (invoke) | Parametry | Vrací |
|---|---|---|
| `JoinSession` | `code: string` | `{ sessionId: string }` |
| `SendOffer` | `sessionId: string, offerJson: string` | — |
| `SendCandidate` | `sessionId: string, candidateJson: string` | — |

| Event (on) | Data |
|---|---|
| `ReceiveAnswer` | `answerJson: string` |
| `ReceiveCandidate` | `candidateJson: string` |