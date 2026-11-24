import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SALON_NAME } from '../App.tsx';
import { api, errorMessage } from '../api.ts';
import type { Review as ReviewItem } from '../api.ts';
import { useSession } from '../session.tsx';

type Summary = { average: number | null; count: number; reviews: ReviewItem[] };

const STARS = [1, 2, 3, 4, 5];
const starLabel = (n: number) => `${n} ${n === 1 ? 'star' : 'stars'}`;
const starRow = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Opened by tapping the NFC tag or scanning the QR code. Needs no account. */
export function Review() {
  const { user } = useSession();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (user && !nameTouched) setName(user.name);
  }, [user, nameTouched]);

  const load = useCallback(() => {
    api<Summary>('/api/reviews')
      .then(setSummary)
      .catch(() => {
        /* the list is a nicety; the form still works without it */
      });
  }, []);

  useEffect(load, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/reviews', { method: 'POST', body: { rating, comment, name } });
      setSent(true);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p className="brand">{SALON_NAME}</p>
      <h1>How was your visit?</h1>

      {sent ? (
        <div className="card">
          <p className="banner">Thank you for your review!</p>
        </div>
      ) : (
        <form className="card form" onSubmit={submit}>
          <div className="stars" role="group" aria-label="Rating">
            {STARS.map((n) => (
              <button
                key={n}
                type="button"
                className="star"
                aria-label={starLabel(n)}
                aria-pressed={rating === n}
                data-lit={n <= rating}
                onClick={() => setRating(n)}
              >
                {n <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>
          <label>
            Comment
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          </label>
          <label>
            Your name (optional)
            <input
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" className="primary" disabled={busy || rating === 0}>
            Send review
          </button>
        </form>
      )}

      {summary && (
        <div className="group">
          <h2>What customers say</h2>
          {summary.count === 0 ? (
            <p className="muted">No reviews yet</p>
          ) : (
            <>
              <p>{`${summary.average} out of 5 · ${summary.count} ${summary.count === 1 ? 'review' : 'reviews'}`}</p>
              <ul className="list reviews">
                {summary.reviews.map((r, i) => (
                  <li key={`${r.createdAt}-${i}`} className="review">
                    <span className="rating" aria-label={`${r.rating} out of 5`}>
                      {starRow(r.rating)}
                    </span>
                    {r.comment && <p>{r.comment}</p>}
                    <span className="muted small">{r.name || 'Guest'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="small">
        <Link to="/">Go to the {SALON_NAME} app</Link>
      </p>
    </section>
  );
}
