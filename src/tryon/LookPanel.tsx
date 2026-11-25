import { useEffect, useState } from 'react';
import { api, apiBlob, errorMessage } from '../api.ts';
import type { LookView } from '../api.ts';
import { hairstyleName } from '../hair/styles.ts';
import type { HairstyleKey } from '../hair/styles.ts';

type Props = {
  styleKey: HairstyleKey;
  color: string;
  /** Takes a photo from the running camera; null while the camera is off. */
  capture: (() => Promise<Blob>) | null;
  faceReady: boolean;
  pollMs?: number;
};

type Mine = { available: boolean; look: LookView | null };

const isPending = (l: LookView | null) => l?.status === 'waiting' || l?.status === 'working';

/** A temporary address for a picture, released when it is replaced or the page is left. */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

/** "See my haircut": send one photo, wait for the picture, show before and after. */
export function LookPanel({ styleKey, color, capture, faceReady, pollMs = 3000 }: Props) {
  const [available, setAvailable] = useState(false);
  const [look, setLook] = useState<LookView | null>(null);
  const [before, setBefore] = useState<{ id: string; blob: Blob } | null>(null);
  const [after, setAfter] = useState<{ id: string; blob: Blob } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pending = isPending(look);
  const doneId = look?.status === 'done' ? look.id : null;
  const beforeUrl = useObjectUrl(before && before.id === doneId ? before.blob : null);
  const afterUrl = useObjectUrl(after && after.id === doneId ? after.blob : null);

  // A picture may already be on its way, or finished, from an earlier visit to this page.
  useEffect(() => {
    let cancelled = false;
    api<Mine>('/api/looks/mine')
      .then((r) => {
        if (cancelled) return;
        setAvailable(r.available);
        setLook(r.look?.status === 'failed' ? null : r.look);
      })
      .catch(() => {
        /* the feature stays hidden; the rest of the page works without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const r = await api<Mine>('/api/looks/mine');
        if (cancelled) return;
        if (!r.look) setError('Your picture was lost. Please try again.');
        else if (r.look.status === 'failed') setError('Your picture could not be made. Please try again.');
        setLook(r.look);
      } catch {
        /* a missed check: try again on the next one */
      }
      if (!cancelled) timer = setTimeout(check, pollMs);
    };
    timer = setTimeout(check, pollMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, pollMs]);

  useEffect(() => {
    if (!doneId) return;
    let cancelled = false;
    apiBlob(`/api/looks/${doneId}/image`)
      .then((blob) => {
        if (!cancelled) setAfter({ id: doneId, blob });
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [doneId]);

  async function send() {
    if (!capture) return;
    setError('');
    setBusy(true);
    try {
      let photo: Blob;
      try {
        photo = await capture();
      } catch {
        setError('The photo could not be taken. Please try again.');
        return;
      }
      const query = new URLSearchParams({ style: styleKey, color });
      const r = await api<{ look: LookView }>(`/api/looks?${query}`, { method: 'POST', body: photo });
      setBefore({ id: r.look.id, blob: photo });
      setLook(r.look);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError('');
    setBusy(true);
    try {
      await api('/api/looks/mine', { method: 'DELETE' });
      setLook(null);
      setBefore(null);
      setAfter(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!available) return null;

  const name = (hairstyleName(look?.styleKey ?? null) ?? 'new haircut').toLowerCase();
  const ahead = look?.status === 'waiting' && look.ahead > 0 ? `${look.ahead} ahead of you. ` : '';

  return (
    <section className="card form look" aria-label="See my haircut">
      <h2>See it for real</h2>
      {afterUrl && (
        <div className="before-after">
          {beforeUrl && (
            <figure>
              <img src={beforeUrl} alt="Your photo" />
              <figcaption>Before</figcaption>
            </figure>
          )}
          <figure>
            <img src={afterUrl} alt={`You with the ${name}`} />
            <figcaption>After</figcaption>
          </figure>
        </div>
      )}
      {afterUrl && (
        <div className="look-actions">
          <a className="button" href={afterUrl} download={`haircut-${look?.styleKey}.png`}>
            Save picture
          </a>
          <button type="button" onClick={remove} disabled={busy}>
            Delete picture
          </button>
        </div>
      )}
      {afterUrl && <p className="hint">Made by AI. Show it to your barber as a guide; your real cut may differ.</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pending ? (
        <>
          <p role="status" className="status">
            {ahead}Making your picture… about a minute, sometimes three. You can take a token while you wait.
          </p>
          <button type="button" onClick={remove} disabled={busy}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <label className="check">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to send one photo of me to Euron, an outside AI service, to make this picture. The salon does not
              save it. Euron keeps the result at a private link for 24 hours and may keep the photo.
            </span>
          </label>
          {!capture && <p className="hint">Start the camera first.</p>}
          {capture && !faceReady && <p className="hint">Line your face up with the oval first.</p>}
          <button type="button" className="primary" onClick={send} disabled={busy || !agreed || !capture || !faceReady}>
            See my haircut
          </button>
        </>
      )}
    </section>
  );
}
