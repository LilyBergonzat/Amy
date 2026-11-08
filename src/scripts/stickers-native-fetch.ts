import 'dotenv/config';
import { REST, Routes, StickerFormatType, type RESTGetStickerPacksResult } from 'discord.js';
import { writeFile } from 'node:fs/promises';
import { configDotenv } from 'dotenv';

configDotenv();

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
const { sticker_packs } = (await rest.get(Routes.stickerPacks())) as RESTGetStickerPacksResult;

const stickers = sticker_packs.flatMap((pack) =>
    pack.stickers.map((sticker) => ({
        id: sticker.id,
        name: sticker.name,
        pack: pack.name,
        format: StickerFormatType[sticker.format_type],
    })),
);

await writeFile('native-stickers.json', JSON.stringify(stickers, null, 2));
console.log(`${stickers.length} stickers across ${sticker_packs.length} packs`);
