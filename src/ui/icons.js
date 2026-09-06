import { getIconUrl } from '../data/icons.js';

// data/icons.js pre-registers a path for every icon id the design calls
// for, even ones with no file uploaded yet ("prepare the game for these
// files" -- see that module's comment), so getIconUrl being truthy does
// NOT mean the image actually exists on disk. The real fallback decision
// has to happen at load time: render the <img> optimistically, and if it
// 404s, swap it for the labeled CSS badge (style.css .icon-fallback) via
// this onerror hook -- never an emoji either way.
if (typeof window !== 'undefined') {
  window.__iconLoadError = function (img, text, title) {
    const span = document.createElement('span');
    span.className = `${img.className} icon-fallback`;
    span.dataset.iconText = text;
    span.title = title;
    img.replaceWith(span);
  };
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Renders one illustrated UI icon by (category, id): an <img> that falls
// back to a small labeled badge on load failure (see above), or the badge
// immediately if no path is registered at all -- never an emoji. `label`
// is the readable name, used for alt text and to derive the fallback
// badge's short text; `extraClass` lets a caller add its own sizing class.
export function iconHtml(category, id, label, extraClass = '') {
  const url = getIconUrl(category, id);
  const cls = `icon icon-${category} icon-${category}-${id}${extraClass ? ' ' + extraClass : ''}`;
  const safeLabel = escapeAttr(label || id);
  const shortText = escapeAttr(shortLabel(label || id));
  if (url) {
    return `<img class="${cls}" src="${url}" alt="${safeLabel}" onerror="window.__iconLoadError(this,'${shortText}','${safeLabel}')" />`;
  }
  return `<span class="${cls} icon-fallback" data-icon-text="${shortText}" title="${safeLabel}"></span>`;
}

function shortLabel(label) {
  const words = label
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || '?').slice(0, 3).toUpperCase();
}
