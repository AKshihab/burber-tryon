import { useCallback, useState } from 'react';
import { KEYS, local } from '../storage.ts';
import { DEFAULT_COLOR, DEFAULT_STYLE, HAIRSTYLES, HAIR_COLORS, isHairColor, isHairstyleKey } from './styles.ts';
import type { HairstyleKey } from './styles.ts';

export type StyleChoice = {
  styleKey: HairstyleKey;
  color: string;
  setStyleKey(key: HairstyleKey): void;
  setColor(hex: string): void;
};

/** The chosen hairstyle and colour, remembered on this device and shared by the 3D and camera screens. */
export function useStyleChoice(): StyleChoice {
  const [styleKey, setStyle] = useState<HairstyleKey>(() => {
    const stored = local.get(KEYS.style);
    return isHairstyleKey(stored) ? stored : DEFAULT_STYLE;
  });
  const [color, setHex] = useState<string>(() => {
    const stored = local.get(KEYS.hairColor);
    return isHairColor(stored) ? stored : DEFAULT_COLOR;
  });

  const setStyleKey = useCallback((key: HairstyleKey) => {
    setStyle(key);
    local.set(KEYS.style, key);
  }, []);
  const setColor = useCallback((hex: string) => {
    setHex(hex);
    local.set(KEYS.hairColor, hex);
  }, []);

  return { styleKey, color, setStyleKey, setColor };
}

export function StylePicker({ choice }: { choice: StyleChoice }) {
  return (
    <>
      <div className="tiles" role="group" aria-label="Hairstyle">
        {HAIRSTYLES.map((s) => (
          <button
            key={s.key}
            type="button"
            className="tile"
            aria-pressed={choice.styleKey === s.key}
            onClick={() => choice.setStyleKey(s.key)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="swatches" role="group" aria-label="Hair colour">
        {HAIR_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            className="swatch"
            aria-label={c.name}
            aria-pressed={choice.color === c.hex}
            style={{ background: c.hex }}
            onClick={() => choice.setColor(c.hex)}
          />
        ))}
      </div>
    </>
  );
}
