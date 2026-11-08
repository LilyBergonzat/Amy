import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import UPNG from 'upng-js';

for (const file of (await readdir('assets/stickers-src')).filter((f) => f.endsWith('.png'))) {
    const data = await readFile(`assets/stickers-src/${file}`);
    const img = UPNG.decode(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    const raw = { width: img.width, height: img.height, channels: 4 as const };

    // toRGBA8 composites each frame (dispose/blend ops applied), so every buffer is a full frame
    const buffers = await Promise.all(
        UPNG.toRGBA8(img).map((frame) => sharp(Buffer.from(frame), { raw }).resize(160).png().toBuffer()),
    );

    await sharp(buffers, { join: { animated: true } })
        .webp({ loop: 0, delay: img.frames.map((frame) => frame.delay) })
        .toFile(`assets/stickers/${file.replace('.png', '.webp')}`);
}
