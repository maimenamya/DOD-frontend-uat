/** Client-side menu thumbnail: remove BG → max edge ~480px → target ≤80KB, hard cap 100KB. */

const MAX_EDGE = 480;
const TARGET_BYTES = 80 * 1024;
const HARD_MAX_BYTES = 100 * 1024;

/** MIT-licensed general object model (bottles/food) via Hugging Face Transformers.js (Apache-2.0). */
const BG_REMOVAL_MODEL = 'onnx-community/BiRefNet_lite-ONNX';

export type MenuThumbnailBlob = {
  blob: Blob;
  fileName: string;
  contentType: string;
};

export type PrepareMenuThumbnailOptions = {
  /** Fired while preparing (first bg-remove may download the model once). */
  onStatus?: (status: 'removing-bg' | 'resizing') => void;
};

type BackgroundRemovalSegmenter = (
  images: File | Blob | string,
) => Promise<Array<{ toBlob: (type?: string, quality?: number) => Promise<Blob> }>>;

let segmenterPromise: Promise<BackgroundRemovalSegmenter> | null = null;

function loadImage(source: Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
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
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

async function encodeUnderCap(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/png',
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

async function getBackgroundRemover(): Promise<BackgroundRemovalSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Browser cache only — do not look for local model files in Angular public/.
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      const segmenter = await pipeline('background-removal', BG_REMOVAL_MODEL, {
        dtype: 'fp16',
      });
      return segmenter as unknown as BackgroundRemovalSegmenter;
    })();
  }
  return segmenterPromise;
}

async function removeBackgroundLazy(file: File): Promise<Blob> {
  const segmenter = await getBackgroundRemover();
  const outputs = await segmenter(file);
  const raw = outputs[0];
  if (!raw) throw new Error('ตัดพื้นหลังไม่สำเร็จ');
  return raw.toBlob('image/png');
}

/**
 * Remove background (browser AI), then resize + compress for menu upload.
 * Prefers WebP (keeps transparency), falls back to PNG.
 */
export async function prepareMenuThumbnail(
  file: File,
  options?: PrepareMenuThumbnailOptions,
): Promise<MenuThumbnailBlob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }

  options?.onStatus?.('removing-bg');
  let source: Blob = file;
  try {
    source = await removeBackgroundLazy(file);
  } catch (error) {
    console.warn('menu thumbnail background removal failed; using original', error);
    // Reset so a later upload can retry model load after a transient CDN failure.
    segmenterPromise = null;
    source = file;
  }

  options?.onStatus?.('resizing');
  const img = await loadImage(source);
  const canvas = drawScaled(img);

  const webp = await encodeUnderCap(canvas, 'image/webp', 'webp');
  if (webp) return webp;

  const png = await encodeUnderCap(canvas, 'image/png', 'png');
  if (png) return png;

  throw new Error('ย่อรูปไม่สำเร็จ — ลองเลือกรูปที่เล็กกว่า');
}
