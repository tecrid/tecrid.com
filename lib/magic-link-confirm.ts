// Only an explicit same-origin POST may exchange the one-time token.
export async function confirmMagicLink(request: Request, auth: {handler(request: Request): Promise<Response>}) {
 const headers = {'cache-control':'no-store','x-robots-tag':'noindex, nofollow'};
 const fail = (status: number, error: string) => Response.json({error}, {status, headers});
 if (request.method !== 'POST') return fail(405, 'Use the sign-in button to continue.');
 const origin = new URL(request.url).origin;
 if (request.headers.get('origin') !== origin) return fail(403, 'Invalid request origin.');
 const body = await request.json().catch(() => null);
 if (typeof body?.token !== 'string' || !body.token || body.token.length > 512) return fail(400, 'Invalid sign-in link.');
 const verification = new URL('/api/auth/magic-link/verify', origin);
 verification.searchParams.set('token', body.token);
 for (const key of ['callbackURL','newUserCallbackURL','errorCallbackURL']) {
  const value = body[key];
  if (value === undefined || value === null || value === '') continue;
  if (typeof value !== 'string') return fail(400, 'Invalid return address.');
  let destination: URL;
  try { destination = new URL(value, origin); } catch { return fail(400, 'Invalid return address.'); }
  if (destination.origin !== origin || destination.username || destination.password) return fail(400, 'Invalid return address.');
  verification.searchParams.set(key, destination.href);
 }
 // A fixed error destination makes verification failures unambiguous, even when
 // a caller's return URL already includes an error query parameter.
 verification.searchParams.set('errorCallbackURL', new URL('/sign-in', origin).href);
 if (!verification.searchParams.has('callbackURL')) verification.searchParams.set('callbackURL', new URL('/dashboard', origin).href);
 const response = await auth.handler(new Request(verification, {headers: request.headers}));
 const location = response.headers.get('location');
 if (response.status !== 302 || !location || new URL(location, origin).pathname === '/sign-in') return fail(400, 'This sign-in link has expired or has already been used. Request a new link.');
 const result = Response.json({url: location}, {headers});
 for (const cookie of response.headers.getSetCookie()) result.headers.append('set-cookie', cookie);
 return result;
}
