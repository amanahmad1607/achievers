export const API_BASE = (
  import.meta.env.VITE_API_URL || ''
).replace(/\/+$/, '');

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function api(path, { method = 'GET', body, blob } = {}) {
  const token = localStorage.getItem('token');

  const endpoint = `${API_BASE}/api${path.startsWith('/') ? path : '/' + path}`;

  const res = await fetch(endpoint, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: 'Bearer ' + token }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (blob && res.ok) return res.blob();

  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error || data.message || 'Request failed'),
      { data }
    );
  }

  return data;
}

export async function download(path, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await api(path, { blob: true }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
