import { useV2, setV2Override } from '../lib/layoutFlag';

/**
 * Dev-only floating chip that flips the V2 layout flag without a rebuild.
 * Hidden in production. Lives outside the route tree so it's always visible.
 */
export function V2DevToggle() {
  const v2 = useV2();
  if (!import.meta.env.DEV) return null;

  return (
    <button
      type="button"
      onClick={() => setV2Override(!v2)}
      title="Toggle V2 layout (dev only)"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        padding: '8px 12px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: v2 ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.92)',
        color: v2 ? '#fff' : '#0f172a',
        border: '1px solid rgba(15,23,42,0.15)',
        boxShadow: '0 10px 24px rgba(15,23,42,0.18)',
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
      }}
    >
      Layout: {v2 ? 'V2' : 'V1'}
    </button>
  );
}
