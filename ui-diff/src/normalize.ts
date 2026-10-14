import sharp from 'sharp';

export interface GrayImage {
  width: number;
  height: number;
  /** 8-bit luminance, row-major, length = width * height. */
  data: Uint8Array;
}

/** Relative size difference above which a DIMENSION_WARNING is recorded. */
export const DIMENSION_WARNING_RATIO = 0.1;

/**
 * Decode an image to 8-bit luminance.
 * EXIF orientation is applied, transparency is composited onto white,
 * animated formats use their first frame only (sharp default).
 */
export async function loadGray(file: string): Promise<GrayImage> {
  const { data, info } = await sharp(file)
    .rotate()
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** Resize (bilinear) to the target size. Returns the input unchanged when sizes already match. */
export async function resizeGray(img: GrayImage, width: number, height: number): Promise<GrayImage> {
  if (img.width === width && img.height === height) return img;
  // toColourspace('b-w') keeps the output single-channel; sharp otherwise expands to 3 channels.
  const data = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 1 } })
    .resize(width, height, { fit: 'fill', kernel: 'linear' })
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  if (data.length !== width * height) {
    throw new Error(`Unexpected resize output size: ${data.length} bytes for ${width}x${height}`);
  }
  return { width, height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** True when either dimension differs by more than the warning ratio, relative to the baseline. */
export function exceedsDimensionTolerance(baseline: GrayImage, current: GrayImage): boolean {
  const dw = Math.abs(current.width - baseline.width) / baseline.width;
  const dh = Math.abs(current.height - baseline.height) / baseline.height;
  return dw > DIMENSION_WARNING_RATIO || dh > DIMENSION_WARNING_RATIO;
}
