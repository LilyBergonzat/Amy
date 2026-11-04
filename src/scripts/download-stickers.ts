import { mkdir, readFile, writeFile } from 'node:fs/promises';

type Sticker = { id: string; format: 'PNG' | 'APNG' | 'Lottie' | 'GIF' };

const sourceUrl = ({ id, format }: Sticker) => {
    if (format === 'Lottie') {
        return `https://discord.com/stickers/${id}.json`;
    }

    return `https://cdn.discordapp.com/stickers/${id}.png`;
};

const stickers = JSON.parse(await readFile('native-stickers.json', 'utf8')) as Sticker[];
const toConvert = stickers.filter((sticker) => sticker.format === 'Lottie' || sticker.format === 'APNG');

await mkdir('assets/stickers-src', { recursive: true });
for (const sticker of toConvert) {
    const res = await fetch(sourceUrl(sticker));
    const ext = sticker.format === 'Lottie' ? 'json' : 'png';
    await writeFile(`assets/stickers-src/${sticker.id}.${ext}`, Buffer.from(await res.arrayBuffer()));
}

console.log(`${toConvert.length} to convert`);
