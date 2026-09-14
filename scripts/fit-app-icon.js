/**
 * Crops the mockup frame out of an app icon so the artwork fills the square.
 *
 *     node scripts/fit-app-icon.js assets/images/icon.png
 *
 * The source art was produced as a *picture of* an app icon: a rounded tile
 * floating on a large black background. iOS masks whatever you give it to a
 * rounded square of its own, so handing it that picture yields a small tile
 * inside a black border with two sets of rounded corners. Cropping to the tile
 * lets the real artwork fill the space and lets iOS round it once.
 *
 * The crop is the tile's own bounding square. Its corners are not forced onto
 * solid tile: iOS rounds the icon at about 22.4% of its width, which is very
 * near the tile's own corner radius, so the mask removes those corners anyway.
 * Insisting they be opaque would zoom far past the artwork for no gain.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT_SIZE = 1024;
/** Above this luminance a pixel is artwork rather than the black surround. */
const INK = 6;
/**
 * Shaved off each edge so the surround's anti-aliased fringe cannot survive as
 * a faint outline once the crop is scaled back up.
 */
const INSET_FRACTION = 0.015;

function luminance(data, w, x, y) {
    const i = (y * w + x) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
}

/** Tightest box containing everything that is not the black surround. */
function contentBox(png) {
    const { width: w, height: h, data } = png;
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (luminance(data, w, x, y) > INK) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) throw new Error('image is entirely background');
    return { minX, maxX, minY, maxY };
}

/** Bilinear sample, so downscaling does not alias the starfield into noise. */
function resize(png, sx, sy, side, out) {
    const { width: w, data } = png;
    const dst = new PNG({ width: out, height: out });
    for (let y = 0; y < out; y++) {
        const fy = sy + ((y + 0.5) * side) / out - 0.5;
        const y0 = Math.max(0, Math.min(png.height - 1, Math.floor(fy)));
        const y1 = Math.min(png.height - 1, y0 + 1);
        const wy = fy - y0;
        for (let x = 0; x < out; x++) {
            const fx = sx + ((x + 0.5) * side) / out - 0.5;
            const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
            const x1 = Math.min(w - 1, x0 + 1);
            const wx = fx - x0;
            const o = (y * out + x) * 4;
            for (let c = 0; c < 3; c++) {
                const p00 = data[(y0 * w + x0) * 4 + c];
                const p10 = data[(y0 * w + x1) * 4 + c];
                const p01 = data[(y1 * w + x0) * 4 + c];
                const p11 = data[(y1 * w + x1) * 4 + c];
                dst.data[o + c] = Math.round(
                    p00 * (1 - wx) * (1 - wy) + p10 * wx * (1 - wy) + p01 * (1 - wx) * wy + p11 * wx * wy
                );
            }
            // App icons must be fully opaque; iOS rejects an alpha channel.
            dst.data[o + 3] = 255;
        }
    }
    return dst;
}

const file = process.argv[2];
if (!file) {
    console.error('usage: node scripts/fit-app-icon.js <icon.png>');
    process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(file));
const box = contentBox(png);
const cx = (box.minX + box.maxX + 1) / 2;
const cy = (box.minY + box.maxY + 1) / 2;

// The tile's bounding square, shaved slightly to drop the outer fringe.
const contentSide = Math.max(box.maxX - box.minX + 1, box.maxY - box.minY + 1);
const side = Math.round(contentSide * (1 - INSET_FRACTION * 2));
let sx = Math.round(cx - side / 2);
let sy = Math.round(cy - side / 2);
sx = Math.max(0, Math.min(png.width - side, sx));
sy = Math.max(0, Math.min(png.height - side, sy));

const out = resize(png, sx, sy, side, OUT_SIZE);
fs.writeFileSync(file, PNG.sync.write(out));

const fill = ((side / png.width) * 100).toFixed(1);
console.log(
    `${path.basename(file)}: content ${box.minX}..${box.maxX} x ${box.minY}..${box.maxY} — ` +
        `cropped to ${side}x${side} at (${sx},${sy}), ${fill}% of the source, rendered at ${OUT_SIZE}px`
);
