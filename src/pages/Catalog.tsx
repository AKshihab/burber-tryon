import { useEffect, useState } from 'react';
import { api, errorMessage, formatPrice } from '../api.ts';
import type { Service } from '../api.ts';

export function Catalog() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<{ services: Service[] }>('/api/services')
      .then((r) => {
        if (!cancelled) setServices(r.services);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = [...new Set((services ?? []).map((s) => s.category))];

  return (
    <section className="page">
      <h1>Catalog</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!services && !error && <p className="muted">Loading…</p>}
      {services && services.length === 0 && <p className="muted">No services yet.</p>}
      {categories.map((category) => (
        <div key={category} className="group">
          <h2>{category}</h2>
          <ul className="list">
            {services!
              .filter((s) => s.category === category)
              .map((s) => (
                <li key={s.id} className="row">
                  <span className="row-main">
                    <span className="row-title">{s.name}</span>
                    <span className="muted small">{s.durationMin} min</span>
                  </span>
                  <span className="price">{formatPrice(s.price)}</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
