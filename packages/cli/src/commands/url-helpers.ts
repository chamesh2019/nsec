/**
 * Helper functions to normalize server URLs and manage server-scoped keyring account keys.
 */

export function normalizeServerUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.host.toLowerCase();
    const pathname = (parsed.pathname === '/' ? '' : parsed.pathname).replace(/\/+$/, '');
    return `${protocol}//${host}${pathname}`;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

export function serverAccountKey(url: string): string {
  return `server:${normalizeServerUrl(url)}`;
}

export function isServerAccountKey(key: string): boolean {
  return typeof key === 'string' && key.startsWith('server:');
}

export function serverUrlFromAccountKey(key: string): string {
  if (isServerAccountKey(key)) {
    return key.slice('server:'.length);
  }
  return key;
}
