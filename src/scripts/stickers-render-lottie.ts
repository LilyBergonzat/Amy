import { mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { type LottiePlayer } from 'lottie-web';

const SIZE = 160;
const FRAME_STEP = 2;
const lottiePath = createRequire(import.meta.url).resolve('lottie-web/build/player/lottie_canvas.min.js');

declare global {
    interface Window {
        lottie: LottiePlayer;
    }
}

const renderFrames = (animationData: object, step: number) => {
    const anim = window.lottie.loadAnimation<'canvas'>({
        container: document.getElementById('w')!,
        renderer: 'canvas',
        loop: false,
        autoplay: false,
        animationData,
        rendererSettings: { clearCanvas: true },
    });
    const canvas = document.querySelector<HTMLCanvasElement>('#w canvas')!;
    const frames: string[] = [];

    for (let f = 0; f < anim.totalFrames; f += step) {
        anim.goToAndStop(f, true);
        frames.push(canvas.toDataURL('image/png'));
    }

    const delay = Math.round((1000 / anim.frameRate) * step);
    anim.destroy();

    return { frames, delay };
};

const browser = await puppeteer.launch();
const page = await browser.newPage();

await page.setContent(`<div id="w" style="width:${SIZE}px;height:${SIZE}px"></div>`);
await page.addScriptTag({ path: lottiePath });
await mkdir('assets/stickers', { recursive: true });

for (const file of (await readdir('assets/stickers-src')).filter((f) => f.endsWith('.json'))) {
    const animationData = JSON.parse(await readFile(`assets/stickers-src/${file}`, 'utf8'));
    const { frames, delay } = await page.evaluate(renderFrames, animationData, FRAME_STEP);
    const buffers = frames.map((dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64'));

    await sharp(buffers, { join: { animated: true } })
        .webp({ loop: 0, delay: frames.map(() => delay) })
        .toFile(`assets/stickers/${file.replace('.json', '.webp')}`);
}

await browser.close();
