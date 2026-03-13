import imageCompression from "browser-image-compression";

export function getMealIcon(time) {
  const h = parseInt((time || "12").split(":")[0]);
  if (h < 10) return "🌅";
  if (h < 14) return "☀️";
  if (h < 18) return "🌤️";
  return "🌙";
}

export async function compress(file) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 768,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.75,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      resolve({ dataUrl, b64: dataUrl.split(",")[1], mime: compressed.type });
    };
    reader.readAsDataURL(compressed);
  });
}
