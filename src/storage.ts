/** localStorage / sessionStorage access that never throws (private windows, blocked storage). */
function wrap(pick: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return pick().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        pick().setItem(key, value);
      } catch {
        /* storage unavailable: carry on without remembering */
      }
    },
    remove(key: string): void {
      try {
        pick().removeItem(key);
      } catch {
        /* nothing to remove */
      }
    },
  };
}

export const local = wrap(() => localStorage);
export const session = wrap(() => sessionStorage);

export const KEYS = {
  session: 'salon.session',
  style: 'salon.style',
  hairColor: 'salon.hairColor',
  alerted: 'salon.alerted',
  staffPin: 'salon.staffPin',
} as const;
