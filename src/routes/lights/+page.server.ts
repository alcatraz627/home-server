import type { PageServerLoad } from './$types';

// Don't discover bulbs on SSR — it takes 3s and blocks page load.
// Client fetches on mount instead.
export const load: PageServerLoad = async () => {
  return { bulbs: [] };
};
