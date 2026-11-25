export type Picture = { bytes: Buffer; type: string };
export type HairEditor = (photo: Buffer, prompt: string) => Promise<Picture>;

/** The service has no room right now; the same request may work in a moment. */
export class BusyError extends Error {
  constructor() {
    super('The picture service is busy');
  }
}

// These keys and colours mirror HAIRSTYLES and HAIR_COLORS in src/hair/styles.ts (a test checks they match).
const STYLES = new Map([
  ['buzz', (c: string) => `very short ${c} buzz cut, clipped to the same short length all over`],
  ['sidepart', (c: string) => `classic short ${c} side part, neatly combed to one side with short tapered sides`],
  ['quiff', (c: string) => `natural ${c} quiff, the front brushed up and back with moderate volume, short tapered sides`],
  ['curly', (c: string) => `${c} haircut with medium-length loose natural curls on top and short sides`],
]);
const COLORS = new Map([
  ['#1b1b1b', 'black'],
  ['#5a3825', 'brown'],
  ['#c9a25d', 'blonde'],
  ['#8c3b20', 'red'],
]);

export function hairPrompt(styleKey: unknown, colorHex: unknown): string | null {
  const style = STYLES.get(styleKey as string);
  const color = COLORS.get(colorHex as string);
  if (!style || !color) return null;
  return (
    `Change only the hairstyle of this person to a ${style(color)}. ` +
    'Keep their face, skin, expression, ears, clothes, background, framing and lighting exactly the same. Do not add anything.'
  );
}

const ENDPOINT = 'https://api.euron.one/api/v1/euri/images/edits';
const MODEL = 'euri-image-edit';
/** One picture normally takes half a minute to three minutes. */
const TIMEOUT_MS = 240_000;

export function createEuronEditor(opts: { apiKey: string; fetchFn?: typeof fetch }): HairEditor {
  const fetchFn = opts.fetchFn ?? fetch;

  return async (photo, prompt) => {
    const form = new FormData();
    form.set('model', MODEL);
    form.set('prompt', prompt);
    form.set('n', '1');
    form.set('image', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'photo.jpg');
    const res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 429 || res.status === 503) throw new BusyError();

    type Reply = { error?: { code?: unknown }; data?: { url?: unknown; b64_json?: unknown }[] };
    const reply = (await res.json().catch(() => null)) as Reply | null;
    // Euron keeps the connection open with status 200 while a request waits, so errors can arrive with it.
    if (reply?.error?.code === 'euri_no_capacity') throw new BusyError();
    if (!res.ok || reply?.error) {
      const code = typeof reply?.error?.code === 'string' ? reply.error.code : 'unknown';
      throw new Error(`Picture service refused the request (${res.status}, ${code})`);
    }

    const first = reply?.data?.[0];
    if (typeof first?.b64_json === 'string') return { bytes: Buffer.from(first.b64_json, 'base64'), type: 'image/png' };
    if (typeof first?.url !== 'string' || !first.url.startsWith('https://'))
      throw new Error('Picture service sent no picture');
    const file = await fetchFn(first.url, { signal: AbortSignal.timeout(60_000) });
    const type = (file.headers.get('content-type') ?? '').split(';')[0];
    if (!file.ok || !/^image\/(png|jpeg|webp)$/.test(type)) throw new Error(`Picture could not be downloaded (${file.status})`);
    return { bytes: Buffer.from(await file.arrayBuffer()), type };
  };
}
