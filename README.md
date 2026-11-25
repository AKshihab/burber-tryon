# Burber — salon app

A phone-first web app for a salon or barber shop.

- **Styles** — try four haircuts and four hair colours on a 3D head you can turn.
- **Try on** — pick a haircut, line your face up with the oval, and see the hair on your own head in the live camera.
- **See my haircut** — the customer agrees, takes one photo, and gets a realistic before/after picture.
- **Catalog** — services with price and duration.
- **Account or guest** — enter with just a name, or register with a phone number and password.
- **Token** — take a place in the queue, see how many are ahead and the estimated wait.
- **15-minute alert** — a banner (and a device notification, if allowed) when the estimated wait drops to 15 minutes.
- **Reviews** — an NFC tag or a QR code opens the review page; no account needed.
- **Staff screen** — see the queue, call the next customer, show the review QR code.

## Run it

Needs Node 24 or newer.

```
npm install
```

Development (two terminals):

```
npm run dev:server     # API on http://localhost:3001
npm run dev:client     # app on http://localhost:5173
```

Production (one process serves the API and the built app):

```
npm run build
npm start              # http://localhost:3001
```

Tests: `npm test`

## Camera try-on

- Works in the browser with MediaPipe Face Landmarker; the live camera picture never leaves the device.
- The face model (`public/mediapipe/face_landmarker.task`) is in the repo. The wasm runtime is copied
  into `public/mediapipe/wasm/` by `npm install` (`scripts/setup-tryon.mjs`). The page is
  only allowed to talk to its own server (`Content-Security-Policy` in `index.html`), which also blocks the
  usage statistics MediaPipe tries to send to Google.
- **Browsers only allow the camera on `localhost` or an `https://` address.** To use it on a phone,
  the site must be served over HTTPS. On plain `http://192.168.x.x` the app says so and offers the
  3D preview instead.
- The hair is simple 3D shapes drawn over the picture. It follows the head, but it does not hide
  the hair you already have, so it reads best on short hair.
- If hair sits too high, low, big or small, adjust `HEAD_FIT` in `src/tryon/face.ts`.

## Haircut pictures (AI)

- Needs `EURI_API_KEY`, a key from [Euron](https://euron.one/euri). Without it the feature is hidden.
  Locally put it in `.env` (git ignores it); on the server set it as an environment variable.
- The key stays on the server. The photo goes browser → salon server → Euron (`euri-image-edit`).
- The salon keeps photos and pictures in memory only: the photo until its picture is made, the picture
  for 30 minutes. Euron keeps the result at a private link for 24 hours; how long it keeps the photo is not known.
- A picture usually took 30-100 seconds in tests (once 163). They are made one at a time; "busy" is tried three times.
- Limits (in `server/looks.ts`): 6 pictures per customer and 150 for the salon per day, 8 waiting at once.
  Restarting the server forgets pictures and resets these counts.
- The AI can change more than the hair; the page tells the customer it is a guide.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `STAFF_PIN` | `1234` | PIN for the staff screen at `/staff`. **Change it before real use.** It can be any text, not only 4 digits; five wrong tries lock that address out for a minute. |
| `EURI_API_KEY` | none | Euron key for haircut pictures. Never commit it. |
| `PORT` | `3001` | Port the server listens on. |

Data is stored in `data/salon.db` (SQLite). Delete the file to start empty.

The salon name is `SALON_NAME` in `src/App.tsx`; the currency sign is `CURRENCY` in `src/api.ts`;
the service list is seeded from `server/db.ts` the first time the database is created.

## Reviews by NFC tag or QR code

1. Open `/staff` and enter the PIN.
2. The **Review link** section shows a QR code and the link itself (`https://your-site/review`).
3. Print the QR code, and/or write the same link to an NFC tag as a URL record
   (any NFC writer app can do this). Tapping the tag or scanning the code opens the review page.

The link uses whatever address the staff screen was opened at, so open it at the public address
of the site before printing.

## How the queue works

- One chair. Token numbers restart at 1 each day. One active token per person.
- The wait is an estimate: the durations of the services ahead of you, with the customer in the
  chair counted only for their remaining time.
- Staff press **Call next** to finish the current customer and seat the next one.

## Known limits

- The alert works on any customer page while the app is open; there is no SMS or push to a closed app.
  The device notification needs HTTPS (or localhost); without it only the in-app banner shows.
- The camera try-on needs HTTPS (or localhost) and a reasonably recent phone.
- No payments, fixed-time bookings, multiple chairs or multiple branches.
- The staff PIN is a single shared PIN, sent with each staff request. Serve the site over HTTPS.
