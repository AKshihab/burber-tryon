# Burber — salon app

A phone-first web app for a salon or barber shop.

- **Styles** — try four haircuts and four hair colours on a 3D head you can turn.
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

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `STAFF_PIN` | `1234` | PIN for the staff screen at `/staff`. **Change it before real use.** |
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

- The alert only works while the token page is open; there is no SMS or push to a closed app.
- No payments, fixed-time bookings, multiple chairs or multiple branches.
- The staff PIN is a single shared PIN, sent with each staff request. Serve the site over HTTPS.
