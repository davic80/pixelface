// Censoring effects applied to a canvas. All work is local pixel manipulation;
// re-exporting the canvas with toBlob() also strips any EXIF metadata.

/**
 * Render the source image and apply the chosen effect to the selected boxes.
 *
 * @param {CanvasRenderingContext2D} ctx  destination 2D context
 * @param {CanvasImageSource} image        original image (already drawn at 1:1)
 * @param {Array<{x,y,w,h}>} boxes         face boxes, image pixel coords
 * @param {object} opts
 * @param {"pixelate"|"blur"|"emoji"} opts.style
 * @param {number} opts.intensity          1..100
 * @param {string} opts.emoji              glyph used when style === "emoji"
 */
export function renderCensored(ctx, image, boxes, opts) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  for (const box of boxes) {
    const b = padBox(box, width, height);
    if (b.w <= 0 || b.h <= 0) continue;
    if (opts.style === "pixelate") pixelate(ctx, b, opts.intensity);
    else if (opts.style === "blur") blur(ctx, b, opts.intensity);
    else if (opts.style === "emoji") emoji(ctx, b, opts.emoji);
  }
}

// Faces look better fully covered with a little padding around the box.
function padBox(box, maxW, maxH) {
  const padX = box.w * 0.08;
  const padY = box.h * 0.12;
  const x = Math.max(0, Math.floor(box.x - padX));
  const y = Math.max(0, Math.floor(box.y - padY));
  const w = Math.min(maxW - x, Math.ceil(box.w + padX * 2));
  const h = Math.min(maxH - y, Math.ceil(box.h + padY * 2));
  return { x, y, w, h };
}

function pixelate(ctx, b, intensity) {
  // intensity 1..100 -> block count: fewer blocks = more pixelation.
  const blocks = Math.max(3, Math.round(32 - (intensity / 100) * 28));
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d");
  tmp.width = blocks;
  tmp.height = Math.max(1, Math.round((blocks * b.h) / b.w));
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(ctx.canvas, b.x, b.y, b.w, b.h, 0, 0, tmp.width, tmp.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, b.x, b.y, b.w, b.h);
  ctx.imageSmoothingEnabled = true;
}

function blur(ctx, b, intensity) {
  // Approximate blur by downscaling the region and upscaling it with smoothing
  // ON. This avoids CanvasRenderingContext2D.filter, which iOS Safari does not
  // handle reliably (blur did nothing on iPhone).
  const dim = Math.max(2, Math.round(b.w * (0.04 + (1 - intensity / 100) * 0.22)));
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d");
  tmp.width = dim;
  tmp.height = Math.max(2, Math.round((dim * b.h) / b.w));
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(ctx.canvas, b.x, b.y, b.w, b.h, 0, 0, tmp.width, tmp.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, b.x, b.y, b.w, b.h);
}

function emoji(ctx, b, glyph) {
  const size = Math.min(b.w, b.h) * 1.15;
  ctx.save();
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, b.x + b.w / 2, b.y + b.h / 2);
  ctx.restore();
}
