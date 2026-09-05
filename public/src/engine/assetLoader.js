// Generic image cache used by the asset registry (data/assets.js). Loading is
// fire-and-forget and failure-safe: a 404 or a not-yet-uploaded file just
// leaves getImage() returning null forever, which callers treat as "fall
// back to the procedural look" rather than an error.
const cache = new Map();

export function loadImage(url) {
  if (!url || cache.has(url)) return;
  const record = { image: null, status: 'loading' };
  cache.set(url, record);
  const img = new Image();
  img.onload = () => {
    record.image = img;
    record.status = 'loaded';
  };
  img.onerror = () => {
    record.status = 'failed';
    console.warn(`[assets] image failed to load, falling back to procedural look: ${url}`);
  };
  img.src = url;
}

export function getImage(url) {
  if (!url) return null;
  const record = cache.get(url);
  if (!record) {
    loadImage(url);
    return null;
  }
  return record.status === 'loaded' ? record.image : null;
}
