import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { StylePicker, useStyleChoice } from '../hair/choice.tsx';
import { TryOnView } from '../tryon/TryOnView.tsx';
import { HINT_TEXT } from '../tryon/face.ts';
import type { GuideHint } from '../tryon/face.ts';

/** Pick a haircut, line your face up with the oval, and see the hair on your own head. */
export function TryOn() {
  const choice = useStyleChoice();
  const [started, setStarted] = useState(false);
  const [hint, setHint] = useState<GuideHint>('none');
  const [error, setError] = useState('');

  const handleError = useCallback((message: string) => {
    setError(message);
    setStarted(false);
  }, []);

  function start() {
    setError('');
    setHint('none');
    setStarted(true);
  }

  return (
    <section className="page">
      <h1>Try it on</h1>
      <StylePicker choice={choice} />

      {started ? (
        <>
          <TryOnView styleKey={choice.styleKey} color={choice.color} onHint={setHint} onError={handleError} />
          <p role="status" className="status">
            {HINT_TEXT[hint]}
          </p>
          <button type="button" onClick={() => setStarted(false)}>
            Stop camera
          </button>
        </>
      ) : (
        <>
          {error && (
            <>
              <p role="alert" className="error">
                {error}
              </p>
              <Link to="/styles">Use the 3D preview instead</Link>
            </>
          )}
          <p className="muted">
            Choose a haircut, then hold your phone so your face fills the oval. The hair is drawn on your head and
            follows you as you turn.
          </p>
          <button type="button" className="primary" onClick={start}>
            Start camera
          </button>
        </>
      )}

      <p className="hint">Your camera picture stays on this device.</p>
      <Link className="primary" to="/token">
        Take a token with this style
      </Link>
    </section>
  );
}
