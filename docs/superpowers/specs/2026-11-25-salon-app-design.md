# Salon App — Design

Date: 2026-11-25. Deadline: 2026-11-30.

Source: one handwritten notebook page ("SALOON"). The owner opted out of design
questions, so everything marked **(call)** is the builder's decision, not theirs.

## Intent

A salon/barber app for customers. From the page:

- 3D hairstyle preview. Sketch: a top bar, a row of four style tiles, and a head
  below wearing the chosen hair.
- Catalog.
- User account or guest mode.
- A token for the user (their place in the queue).
- Notification to the user 15 minutes before their turn.
- NFC tap or scan to leave a review.
- A "case study" accompanies the project (not part of the software).

Added by the owner on 2026-11-25 (their words, tidied): anyone who wants to see
which haircut suits them selects the haircut, stands in a certain place in front
of the camera, and the haircut is shown on their own head in the camera view.

Why it is being built (real salon, coursework, client demo) is unknown.

## Goals

1. A customer on a phone can enter as a guest with only a name, or register and log in.
2. They can try four hairstyles on a rotatable 3D head and change hair colour.
2a. **Camera try-on:** they pick a haircut, line their face up with an on-screen
    guide, and the chosen hair is drawn on their own head in the live camera view,
    following the head as it moves.
3. They can browse services with price and duration.
4. They can take a queue token, see their number, how many are ahead and the estimated wait.
5. They are alerted when the estimated wait drops to 15 minutes or less.
6. Tapping an NFC tag or scanning a QR code opens a review form; reviews are stored and listed.
7. Salon staff can see the queue and call the next customer.

## Non-goals

- Photorealistic hair, hiding the customer's existing hair, or saving/sharing photos.
- Payments, booking a fixed time slot, multiple branches, multiple chairs.
- Alerts when the app is closed (true push, SMS).
- Native Android/iOS apps.

## Anti-goals

- A guest must never be forced to create an account to take a token or leave a review.
- Nothing the 3D or camera screens need may be fetched from the internet while the
  app is running; everything is served by the app itself so a demo cannot fail on a download.
- Camera frames never leave the device.

## Decisions (all **call**)

| Topic | Decision | Why |
|---|---|---|
| Platform | Phone-first web app | One build works on any phone; NFC tags and QR codes can open a URL with no install. |
| Front end | Vite + React + TypeScript, three.js, react-router | Common, fast to build. |
| Server | Node 24 + Express 5, SQLite through built-in `node:sqlite` | No native compile step on Windows; one file database. |
| 3D | Head and four hairstyles built from three.js primitives in code | No assets to source or license; nothing to fail loading. |
| Camera try-on | MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) running in the browser gives the head position each frame; the same three.js hair is drawn over the video. Its model file and wasm are served from the app | Free, runs on phones, no server processing of faces. |
| Face guide | An oval on the camera view with a hint ("Move closer", "Centre your face"); hair is drawn whenever a face is found | "A certain place of the camera" in the owner's words. |
| Camera access | Works on `localhost` and on HTTPS only (a browser rule). On a phone the app must be opened over HTTPS | Cannot be worked around in code. |
| Hairstyles | Buzz cut, Side part, Quiff, Curly top | Four tiles in the sketch. |
| Accounts | Name + phone + password; guest gives a name only | Phone is the natural salon identifier. |
| Queue | One chair; a token number restarts at 1 each day; one active token per user | Simplest model matching "token". |
| Wait estimate | Sum of the service durations of tokens ahead; the one being served counts only its remaining time | Tokens have no fixed time, so the alert needs an estimate. |
| Alert | In-app banner plus a browser notification if permitted, while the app is open; the page checks every 15 seconds | True push needs HTTPS hosting and keys; out of reach for the deadline. |
| NFC / scan | Both open `<site>/review`. Staff screen shows the QR code and the URL to write to a tag | Same work for both. |
| Staff | `/staff` screen behind a PIN from the `STAFF_PIN` environment variable (default `1234`) | Enough for one salon. |
| Prices | Whole numbers shown with `৳`, set in one constant | Assumed locale; trivial to change. |

## Approaches considered

1. **Phone-first web app with a small server (chosen).** Covers every item on the page, runs on any phone, NFC/QR work through plain links.
2. **Native mobile app (Flutter/React Native).** Better notifications and NFC reading, but store builds and device setup do not fit five days.
3. **Front end only, data in the browser.** Fastest, but a queue and reviews must be shared between customers and staff, so it cannot work.

## Left to the builder

Visual design, exact copy, hair geometry details, seed service list.
