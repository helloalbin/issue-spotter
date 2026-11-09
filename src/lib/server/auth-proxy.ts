/**
 * Serves Firebase's sign-in pages from this site's own address, so Google's consent screen names
 * this site and not `<project>.firebaseapp.com`. Only the two path families Firebase's sign-in uses
 * are passed on, and only to that project's own host, so this cannot be turned into a general relay.
 */
const PATHS = ['/__/auth/', '/__/firebase/'];
const SEGMENT = /^[A-Za-z0-9._-]+$/;
const PROJECT = /^[a-z0-9-]{1,63}$/;
const MAX_SEARCH = 4096;

/** Where a request for `url` should be fetched from, or null if it is not one to pass on. */
export function proxyTarget(url: URL, projectId: string | undefined): URL | null {
	if (!projectId || !PROJECT.test(projectId)) return null;
	const { pathname, search } = url;
	if (!PATHS.some((prefix) => pathname.startsWith(prefix)) || search.length > MAX_SEARCH) return null;
	const segments = pathname.slice(1).split('/');
	if (segments.some((segment) => !SEGMENT.test(segment) || segment === '..' || segment === '.')) return null;
	return new URL(`https://${projectId}.firebaseapp.com${pathname}${search}`);
}

/** Whether a path belongs to the sign-in proxy. */
export const isProxyPath = (pathname: string) => PATHS.some((prefix) => pathname.startsWith(prefix));

/**
 * Fetches the page for the browser. No cookies or credentials go out, and only the type and caching
 * headers come back, so nothing from Firebase's reply can set a cookie or a policy on this site.
 */
export async function passOn(
	request: Request,
	projectId: string | undefined,
	fetcher: typeof fetch = fetch
): Promise<Response | null> {
	const target = proxyTarget(new URL(request.url), projectId);
	if (!target) return null;
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
	}

	let upstream: Response;
	try {
		upstream = await fetcher(target, {
			method: request.method,
			headers: { accept: request.headers.get('accept') ?? '*/*' },
			redirect: 'manual'
		});
	} catch {
		return new Response('Sign-in is unavailable right now.', { status: 502 });
	}
	if (upstream.status >= 300 && upstream.status < 400) return new Response('Bad gateway', { status: 502 });

	const headers = new Headers();
	for (const name of ['content-type', 'cache-control', 'etag']) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}
	// The sign-in frame is shown inside this site's own pages and nowhere else.
	headers.set('content-security-policy', "frame-ancestors 'self'");
	return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
}
