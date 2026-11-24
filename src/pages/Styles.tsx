import { Link } from 'react-router-dom';
import { HairViewer } from '../hair/HairViewer.tsx';
import { StylePicker, useStyleChoice } from '../hair/choice.tsx';

export function Styles() {
  const choice = useStyleChoice();
  return (
    <section className="page">
      <h1>Find your style</h1>
      <StylePicker choice={choice} />
      <HairViewer styleKey={choice.styleKey} color={choice.color} />
      <p className="muted small">Drag the head to see the sides and back.</p>
      <Link className="primary" to="/token">
        Take a token with this style
      </Link>
    </section>
  );
}
