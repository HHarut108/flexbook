import { lazy, type ComponentType } from 'react';

/**
 * React.lazy expects modules with a `default` export. Our screens use named
 * exports (`export function FlightResultsScreen`), so this helper wraps the
 * dynamic import and re-shapes the resolved module into the `{ default: ... }`
 * shape React expects.
 *
 *   const FlightResultsScreen = lazyNamed(
 *     () => import('../screens/FlightResultsScreen'),
 *     'FlightResultsScreen',
 *   );
 *
 * Side-benefit: the second argument doubles as documentation — `grep` for a
 * screen name still finds the call site.
 *
 * Module record is typed loosely (`Record<string, unknown>`) so modules that
 * also re-export non-component values (constants, types, helpers like
 * `ToolsScreen` does with TOOLS_V2) don't trip TypeScript when passed in.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- intentional:
 * the props of the underlying screen vary per call site; ComponentType<any>
 * matches React.lazy's own internal signature for arbitrary-prop components.
 */
export function lazyNamed(
  factory: () => Promise<Record<string, unknown>>,
  exportName: string,
) {
  return lazy(async () => {
    const mod = await factory();
    const Component = mod[exportName] as ComponentType<any> | undefined;
    if (!Component) {
      throw new Error(
        `lazyNamed: module did not export "${exportName}". Found: ${Object.keys(mod).join(', ')}`,
      );
    }
    return { default: Component };
  });
}
