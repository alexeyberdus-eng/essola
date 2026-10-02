import { parseRecipesCsv } from '../../lib/recipeCsv';
import type { Recipe } from '../recipes';
import { BODY } from './body';
import { FACE } from './face';
import { HAIR } from './hair';
import { LIPS_BATH } from './lipsbath';
import { MORE } from './more';

/** Recipes by the essola editors, parsed once from the table format the CSV import uses too. */
export const EDITORIAL: Recipe[] = [FACE, BODY, HAIR, LIPS_BATH, MORE].flatMap((t, i) => parseRecipesCsv(t, { idPrefix: `ed${i}`, editorial: true }).recipes);
