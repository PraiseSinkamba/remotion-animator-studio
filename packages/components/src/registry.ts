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
import './base/definitions';
// Trading components (Chart Studio first-party) register here:
import './trading/definitions/candlestick-chart';
import './motion/definitions/marker-highlight';
import './motion/definitions/soft-blur-in';
import './motion/definitions/typewriter';

export * from '@chart-studio/core';

import type { ComponentCategory } from '@chart-studio/core';

/** Order the library panel renders the categories in. */
export const CATEGORY_ORDER: ComponentCategory[] = ['base', 'trading', 'motion'];

/** Heading shown above each category in the library panel. */
export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  base: 'Elements',
  trading: 'Trading',
  motion: 'Motion',
};
