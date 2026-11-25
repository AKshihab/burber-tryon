/** Sent photos are square and this big: smaller or narrower ones came back zoomed in. */
export const PHOTO_SIDE = 768;

/** The square in the middle of the camera picture: exactly what the square frame on the page shows. */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

/** Take the current camera frame as a JPEG. Drawing it again leaves out any location or camera details. */
export function takePhoto(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { x, y, side } = centerSquare(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx || !side) return reject(new Error('No camera picture'));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, x, y, side, side, 0, 0, PHOTO_SIDE, PHOTO_SIDE);
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No camera picture'))), 'image/jpeg', 0.92);
  });
}
