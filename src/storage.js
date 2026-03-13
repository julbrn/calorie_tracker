function getDayKey() {
  const d = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return `ct_log:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function cleanOldLogs() {
  const today = getDayKey();
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith("ct_log:") && k !== today) localStorage.removeItem(k);
  });
}

function saveImage(id, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(`ct_img:${id}`, dataUrl);
  } catch (e) {}
}

function loadImage(id) {
  try {
    return localStorage.getItem(`ct_img:${id}`) || null;
  } catch (e) {
    return null;
  }
}

export function removeImage(id) {
  try {
    localStorage.removeItem(`ct_img:${id}`);
  } catch (e) {}
}

export function saveLog(log) {
  try {
    const slim = log.map(({ id, time, description, items, total }) => ({
      id,
      time,
      description,
      items,
      total,
    }));
    localStorage.setItem(getDayKey(), JSON.stringify(slim));
  } catch (e) {}
}

export function persistImage(id, dataUrl) {
  saveImage(id, dataUrl);
}

export function loadLog() {
  cleanOldLogs();
  try {
    const raw = localStorage.getItem(getDayKey());
    if (!raw) return [];
    return JSON.parse(raw).map((e) => ({ ...e, image: loadImage(e.id) }));
  } catch (e) {
    return [];
  }
}
