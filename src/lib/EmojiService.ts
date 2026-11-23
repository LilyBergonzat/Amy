import { container } from '@sapphire/framework';
import { noop } from '@sapphire/utilities';

const MAX_EMOJIS = 1900;

const emojiLocks: Map<string, Promise<unknown>> = new Map();

async function withEmojiLock<T>(emojiId: string, callback: () => Promise<T>): Promise<T> {
    const previous = emojiLocks.get(emojiId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(callback);

    emojiLocks.set(emojiId, current);

    try {
        return await current;
    } finally {
        if (emojiLocks.get(emojiId) === current) {
            emojiLocks.delete(emojiId);
        }
    }
}

async function getProxyEmoji(originalId: string) {
    const ownEmoji = await container.client.application?.emojis.fetch(originalId).catch(() => null);

    if (ownEmoji) {
        return ownEmoji;
    }

    const existingProxy = await container.prisma.emoji.findUnique({ where: { idOriginal: originalId } });
    const existingProxyEmoji =
        existingProxy ? await container.client.application?.emojis.fetch(existingProxy.id).catch(() => null) : null;

    if (existingProxy && !existingProxyEmoji) {
        await container.prisma.emoji.deleteMany({ where: { id: existingProxy.id } });
    }

    return existingProxyEmoji;
}

async function getProxyAvatarEmoji(id: string, hash: string) {
    const existingProxy = await container.prisma.emoji.findUnique({ where: { idOriginal: id } });
    const emoji =
        existingProxy ? await container.client.application?.emojis.fetch(existingProxy.id).catch(() => null) : null;

    if (existingProxy && (existingProxy.avatarHash !== hash || !emoji)) {
        await container.prisma.emoji.deleteMany({ where: { id: existingProxy.id } });

        if (emoji) {
            await container.client.application?.emojis.delete(emoji.id).catch(noop);
        }

        return null;
    }

    return emoji;
}

async function ensureFreeEmojiSpace() {
    const emojis = await container.client.application?.emojis.fetch();

    if (!emojis || emojis.size < MAX_EMOJIS) {
        return;
    }

    let deleted = 0;

    do {
        const toDelete = await container.prisma.emoji.findFirst({ orderBy: { lastUsed: 'asc' } });

        if (!toDelete) {
            return;
        }

        if (emojis.has(toDelete.id)) {
            await container.client.application?.emojis.delete(toDelete.id).catch(noop);
            deleted++;
        }

        await container.prisma.emoji.deleteMany({ where: { id: toDelete.id } });
    } while (emojis.size - deleted >= MAX_EMOJIS);
}

async function saveEmoji(originalId: string, animated: boolean) {
    await ensureFreeEmojiSpace();

    const url = container.client.rest.cdn.emoji(originalId, { extension: 'webp', animated });
    const emoji = await container.client.application?.emojis
        .create({ attachment: url, name: originalId })
        .catch((error) => {
            container.logger.error(error);
            return null;
        });

    if (!emoji) {
        return null;
    }

    await container.prisma.emoji.create({ data: { id: emoji.id, idOriginal: originalId } });

    return emoji;
}

async function saveAvatar(id: string, hash: string, url: string) {
    await ensureFreeEmojiSpace();

    const emoji = await container.client.application?.emojis.create({ attachment: url, name: id }).catch((error) => {
        container.logger.error(error);
        return null;
    });

    if (!emoji) {
        return null;
    }

    await container.prisma.emoji.create({ data: { id: emoji.id, idOriginal: id, avatarHash: hash } });

    return emoji;
}

export async function getEmojiAvatar(url: string) {
    const globalRegex =
        /^https:\/\/cdn\.discordapp\.com\/avatars\/(?<id>\d{17,20})\/(?<hash>(?:a_)?[0-9a-f]{32})\..+$/v;
    const guildRegex =
        /^https:\/\/cdn\.discordapp\.com\/guilds\/\d{17,20}\/users\/(?<id>\d{17,20})\/avatars\/(?<hash>(?:a_)?[0-9a-f]{32})\..+$/v;
    const anonymousRegex =
        /^https:\/\/cdn\.discordapp\.com\/icons\/(?<id>\d{17,20})\/(?<hash>(?:a_)?[0-9a-f]{32})\..+$/v;

    if (!globalRegex.test(url) && !guildRegex.test(url) && !anonymousRegex.test(url)) {
        return null;
    }

    const matches =
        globalRegex.test(url) ? globalRegex.exec(url)
        : guildRegex.test(url) ? guildRegex.exec(url)
        : anonymousRegex.exec(url);
    const id = matches?.groups?.id;
    const hash = matches?.groups?.hash;

    if (!id || !hash) {
        return null;
    }

    await container.prisma.emoji.updateMany({
        where: { idOriginal: id },
        data: { lastUsed: new Date() },
    });

    return withEmojiLock(id, async () => (await getProxyAvatarEmoji(id, hash)) || (await saveAvatar(id, hash, url)));
}

export async function replaceEmojis(content: string) {
    const regex = /<(?<animated>a?):(?<name>[A-Za-z0-9_]{2,32}):(?<id>\d{17,20})>/gv;
    let newContent: string = content;
    let matches;

    while ((matches = regex.exec(content))) {
        const { animated, id } = { animated: undefined, id: undefined, ...(matches?.groups ?? {}) };

        if (
            !id ||
            container.client.emojis.cache.has(id) ||
            (await container.client.application?.emojis.fetch(id).catch(() => null))
        ) {
            continue;
        }

        await container.prisma.emoji.updateMany({
            where: { idOriginal: id },
            data: { lastUsed: new Date() },
        });

        const proxyEmoji = await withEmojiLock(
            id,
            async () => (await getProxyEmoji(id)) || (await saveEmoji(id, Boolean(animated))),
        );

        if (!proxyEmoji) {
            continue;
        }

        newContent = newContent.replaceAll(matches[0], proxyEmoji.toString());
    }

    return newContent;
}
