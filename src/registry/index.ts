/**
 * Public entry point of the component registry.
 *
 * Every component module registers itself on import; importing this module
 * registers them all, so the library panel, the inspector, the timeline, the
 * project loader and the Remotion composition all read the same catalog.
 *
 * To add a component: write one definition module that calls `registerComponent`
 * and add its import below. Nothing else needs to change.
 */
import './legacy';
import '../motion-components/definition';
// Trading components (Chart Studio first-party) register here:
// import '../trading/definition';

export * from './registry';
export * from './types';

import type { ComponentCategory } from './types';

/** Order the library panel renders the categories in. */
export const CATEGORY_ORDER: ComponentCategory[] = ['generic', 'trading', 'motion'];

/** Heading shown above each category in the library panel. */
export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  generic: 'Elements',
  trading: 'Trading',
  motion: 'Motion',
};
