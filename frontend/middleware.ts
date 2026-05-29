import { rewrite } from '@vercel/functions';

// Same-origin proxy for the backend API. The browser always calls /api on the
// frontend's own origin so the auth cookie stays first-party — the backend sets
// it SameSite=None;Secure, which browsers increasingly block as a third-party
// cookie when the API lives on a different domain.
//
// BACKEND_ORIGIN chooses which backend the proxy targets and is set per Vercel
// environment: Production -> prod Render, Preview -> staging Render. When unset
// (e.g. local or an un-configured deploy) it falls back to prod, so behaviour is
// identical to the previous vercel.json rewrite.
const PROD_BACKEND = 'https://flexbook-backend-db9r.onrender.com';

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request) {
  const origin = process.env.BACKEND_ORIGIN || PROD_BACKEND;
  const { pathname, search } = new URL(request.url);
  // Strip the /api prefix to mirror the old rewrite (/api/:path* -> backend/:path*).
  const target = new URL(pathname.replace(/^\/api/, '') + search, origin);
  return rewrite(target);
}
