import { useEffect, useState } from 'react';
import { EXTRA_RECIPES, Recipe } from '../data/recipes';
import { editorialList } from './social';

let loaded: Promise<Recipe[]> | null = null;

/** Admin-published recipes (fetched once per app start). */
export function useExtraRecipes() {
  const [list, setList] = useState<Recipe[]>(EXTRA_RECIPES);
  useEffect(() => {
    loaded ??= editorialList()
      .then((items) => {
        EXTRA_RECIPES.splice(0, EXTRA_RECIPES.length, ...items);
        return items;
      })
      .catch(() => []);
    loaded.then((items) => setList([...items]));
  }, []);
  return list;
}

/** Forget the cache after the admin publishes, so the feed shows new recipes right away. */
export function refreshExtraRecipes() {
  loaded = null;
}
