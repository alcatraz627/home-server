/**
 * Creates a reactive table sort controller using Svelte 5 runes.
 * Returns sort state and a toggle function for column headers.
 */
export function createTableSort<T extends string>(defaultKey: T, defaultDir: 'asc' | 'desc' = 'asc') {
  let key = $state<T>(defaultKey);
  let dir = $state<'asc' | 'desc'>(defaultDir);

  function toggle(newKey: T, defaultDirForKey?: 'asc' | 'desc') {
    if (key === newKey) {
      dir = dir === 'asc' ? 'desc' : 'asc';
    } else {
      key = newKey;
      dir = defaultDirForKey ?? 'asc';
    }
  }

  return {
    get key() {
      return key;
    },
    set key(k: T) {
      key = k;
    },
    get dir() {
      return dir;
    },
    set dir(d: 'asc' | 'desc') {
      dir = d;
    },
    toggle,
    get indicator() {
      return (col: T) => (col === key ? (dir === 'asc' ? ' \u25B2' : ' \u25BC') : '');
    },
    /** Returns 'asc' | 'desc' | null — useful for icon-based sort indicators */
    get activeDir() {
      return (col: T): 'asc' | 'desc' | null => (col === key ? dir : null);
    },
  };
}
