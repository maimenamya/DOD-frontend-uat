/** Client-side menu thumbnail: max edge ~480px, target ≤80KB, hard cap 100KB. */

const MAX_EDGE = 480;
const TARGET_BYTES = 80 * 1024;
const HARD_MAX_BYTES = 100 * 1024;

export type MenuThumbnailBlob = {
  blob: Blob;
  fileName: string;
  contentType: string;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('อ่านไฟล์รูปไม่ได้'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function drawScaled(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ไม่สามารถย่อรูปได้');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

async function encodeUnderCap(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/jpeg',
  ext: string,
): Promise<MenuThumbnailBlob | null> {
  let quality = 0.82;
  for (let i = 0; i < 8; i += 1) {
    const blob = await canvasToBlob(canvas, type, quality);
    if (!blob) return null;
    if (blob.size <= TARGET_BYTES || (blob.size <= HARD_MAX_BYTES && quality <= 0.55)) {
      if (blob.size > HARD_MAX_BYTES) return null;
      return { blob, fileName: `thumb.${ext}`, contentType: type };
    }
    quality -= 0.08;
  }
  const last = await canvasToBlob(canvas, type, 0.45);
  if (!last || last.size > HARD_MAX_BYTES) return null;
  return { blob: last, fileName: `thumb.${ext}`, contentType: type };
}

/**
 * Resize + compress a user-picked image for menu upload.
 * Prefers WebP, falls back to JPEG.
 */
export async function prepareMenuThumbnail(file: File): Promise<MenuThumbnailBlob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }
  const img = await loadImage(file);
  const canvas = drawScaled(img);

  const webp = await encodeUnderCap(canvas, 'image/webp', 'webp');
  if (webp) return webp;

  const jpeg = await encodeUnderCap(canvas, 'image/jpeg', 'jpg');
  if (jpeg) return jpeg;

  throw new Error('ย่อรูปไม่สำเร็จ — ลองเลือกรูปที่เล็กกว่า');
}
