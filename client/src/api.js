export async function api(path, { method = 'GET', body, blob } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body && JSON.stringify(body),
  });
  if (blob && res.ok) return res.blob();
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { data });
  return data;
}

export async function download(path, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await api(path, { blob: true }));
  a.download = filename; a.click();
}
