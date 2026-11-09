import path from 'node:path';
import knex from 'knex';
import 'dotenv-expand/config';
import fs from 'node:fs';
import { SECOND } from '../lib/utils/datetime.js';
import { container, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord-api-types/v10';
import { once } from 'node:events';
import { createPrisma } from '../lib/utils/database.js';
import { computeUserData, type UserData } from '../lib/threads/ThreadService.js';
import { DiscordSnowflake } from '@sapphire/snowflake';
import { buildMentionsData } from '../lib/utils/mention.js';
import { SettingsService } from '../lib/SettingsService.js';
import { saveAttachment } from '../lib/threads/ThreadAttachmentService.js';
import { pathToFileURL } from 'node:url';
import type { ThreadMessageCreateWithoutThreadInput } from '../generated/prisma/models/ThreadMessage.js';

type DragoryThread = {
    id: string;
    is_legacy: number;
    user_id: string;
    user_name: string;
    channel_id: string | null;
    created_at: string;
    scheduled_close_at: string | null;
    thread_number: number | null;
};

type DragoryMessage = {
    id: number;
    thread_id: string;
    message_type: number;
    user_id: string | null;
    user_name: string;
    is_anonymous: number;
    dm_message_id: string | null;
    created_at: string;
    message_number: number | null;
    inbox_message_id: string | null;
    dm_channel_id: string | null;
    attachments: string | null;
    small_attachments: string | null;
    use_legacy_format: number | null;
    metadata: string | null;
    body: string | null;
};

function printUsage() {
    console.log('Usage: npm run script:import:dragory');
    console.log('Example: npm run script:import:dragory');
    console.log('');
    console.log(
        'Make sure to set the DRAGORY_DB environment variable with a connection string (mysql) or a path to your database file (sqlite3).',
    );
}

function printUsageAndExit(code: number = 1): never {
    printUsage();
    process.exit(code);
}

function parseDragoryDate(value: string) {
    return new Date(`${value.replace(' ', 'T')}Z`);
}

function parseAttachmentUrl(url: string) {
    const match = /^\/attachments\/(?<channelId>\d+)\/(?<id>\d+)\/(?<name>[^\/]+)$/v.exec(new URL(url).pathname);

    return match ? { id: match.groups!.id!, name: decodeURIComponent(match.groups!.name!) } : null;
}

const dbInfo = process.env.DRAGORY_DB;

if (!dbInfo) {
    printUsageAndExit();
}

const asUrl = URL.canParse(dbInfo) ? new URL(dbInfo) : null;
const knexOptions = (
    asUrl && ['mysql:', 'mariadb:'].includes(asUrl.protocol) ?
        { client: 'mysql2', connection: { uri: dbInfo, dateStrings: true }, acquireConnectionTimeout: 10 * SECOND }
    :   {
            client: 'sqlite3',
            connection: { filename: `${pathToFileURL(path.resolve(dbInfo)).href}?mode=ro`, flags: ['OPEN_URI'] },
            useNullAsDefault: true,
        }) satisfies knex.Knex.Config;

if (knexOptions.client === 'sqlite3' && !fs.existsSync(path.resolve(dbInfo))) {
    console.error('Unable to find your database file. Maybe you made a typo?');
    process.exit(2);
}

const db = knex(knexOptions);

try {
    await db.raw('SELECT 1');
} catch (error) {
    console.error('Unable to connect to your database:', error);
    await db.destroy();
    process.exit(3);
}

if (!(await db.schema.hasTable('threads')) || !(await db.schema.hasTable('thread_messages'))) {
    console.error('The database you linked does not seem to be a Dragory Modmail database.');
    await db.destroy();
    process.exit(4);
}

const client = new SapphireClient({
    intents: [GatewayIntentBits.Guilds],
    baseUserDirectory: null,
    loadDefaultErrorListeners: false,
});

container.prisma = createPrisma();
container.settings = new SettingsService();

await container.prisma.$connect();
await client.login(process.env.DISCORD_TOKEN);
await once(client, 'clientReady');

if (!(await container.settings.getInboxServer())) {
    console.error('You need to configure this bot before trying to import data.');
    await db.destroy();
    process.exit(5);
}

const alreadyImported = new Set(
    (await container.prisma.thread.findMany({ where: { source: 'DRAGORY' } })).map((row) => row.idLegacy),
);
const threads = await db<DragoryThread>('threads').whereNotIn('id', [...alreadyImported]);
const allMessages = await db<DragoryMessage>('thread_messages').whereNotIn('message_type', [8, 9]).orderBy('id');
const messages = allMessages.filter((message) => !alreadyImported.has(message.thread_id));

console.log(
    `Found ${threads.length} thread${threads.length > 1 ? 's' : ''} (skipped ${alreadyImported.size} already imported).`,
);
console.log(`Found ${messages.length} message${messages.length > 1 ? 's' : ''}.`);

function mockUserData(id: string, name?: string | null) {
    const defaultAvatar = client.rest.cdn.defaultAvatar(Number((BigInt(id) >> 22n) % 6n));

    return {
        id,
        bot: false,
        system: false,
        flags: 0,
        username: name ?? 'unknown_user',
        globalName: name ?? 'Unknown user',
        discriminator: '0',
        avatar: null,
        banner: null,
        accentColor: null,
        avatarDecoration: null,
        avatarDecorationData: null,
        collectibles: null,
        primaryGuild: null,
        createdTimestamp: DiscordSnowflake.timestampFrom(id),
        defaultAvatarURL: defaultAvatar,
        hexAccentColor: null,
        tag: null,
        avatarURL: defaultAvatar,
        bannerURL: null,
        guildTagBadgeURL: null,
        displayName: name ?? 'Unknown user',
        displayAvatarURL: defaultAvatar,
        displayAvatarURLAnimated: defaultAvatar,
    };
}

const userDataCache = new Map<string, Promise<UserData>>();

function buildUserData(userId: string, username?: string | null) {
    let cached = userDataCache.get(userId);

    if (!cached) {
        cached = (async () => {
            const user = await container.client.users.fetch(userId).catch(() => null);

            return user ? await computeUserData(user) : mockUserData(userId, username);
        })();
        userDataCache.set(userId, cached);
    }

    return cached;
}

function isStaffMessage(message: DragoryMessage) {
    return [2, 4, 6, 7].includes(message.message_type);
}

function isStaffReply(message: DragoryMessage) {
    return [4, 7].includes(message.message_type);
}

function isInternalMessage(message: DragoryMessage) {
    return [1, 2, 6].includes(message.message_type);
}

for (let i = 0; i < threads.length; i++) {
    const progress = `${(i + 1).toString().padStart(threads.length.toString().length, '0')}/${threads.length}`;
    const percent = `${Math.floor(((i + 1) / threads.length) * 100)
        .toString()
        .padStart(3, '0')}%`;
    const thread = threads[i];
    const userId = thread.user_id;
    const username = thread.user_name ?? client.user!.username;
    const originalThreadMessages = messages.filter((m) => m.thread_id === thread.id);
    const threadMessages = [] as ThreadMessageCreateWithoutThreadInput[];

    console.log(
        `${progress} (${percent}): Thread ${thread.id} created at ${thread.created_at} with ${originalThreadMessages.length} message${originalThreadMessages.length > 1 ? 's' : ''}`,
    );

    for (const message of originalThreadMessages) {
        const mentionsData = JSON.stringify(await buildMentionsData(message.body));
        const createdAt = parseDragoryDate(message.created_at);

        threadMessages.push({
            idMessage:
                isStaffMessage(message) ?
                    (message.inbox_message_id ?? message.dm_message_id)
                :   (message.dm_message_id ?? message.inbox_message_id),
            idStaff: isStaffMessage(message) ? (message.user_id ?? client.user!.id) : null,
            senderData: JSON.stringify(
                await buildUserData(
                    message.user_id ?? client.user!.id,
                    message.user_id ? message.user_name : client.user!.username,
                ),
            ),
            contents: message.body ?? '',
            mentionsData,
            internal: isInternalMessage(message),
            anonymous: isStaffReply(message) ? message.is_anonymous === 1 : null,
            idLegacy: String(message.id),
            createdAt,
            edits: { create: { contents: message.body ?? '', mentionsData, createdAt } },
        });
    }

    const closedDateTime = thread.scheduled_close_at ?? originalThreadMessages.at(-1)?.created_at ?? thread.created_at;

    await container.prisma.thread.create({
        data: {
            idRecipient: userId,
            recipientData: JSON.stringify(await buildUserData(userId, username)),
            isOpen: null,
            source: 'DRAGORY',
            idLegacy: thread.id,
            legacyNumber: thread.thread_number,
            openedAt: parseDragoryDate(thread.created_at),
            closedAt: parseDragoryDate(closedDateTime),
            messages: { create: threadMessages },
        },
    });
}

console.log(`Done importing threads!`);
console.log(`Now checking for missing attachments...`);

const messagesWithAttachments = allMessages.filter((message) => {
    let length;

    try {
        length = JSON.parse(message.attachments ?? '[]').length;
    } catch {
        length = 0;
    }

    return length > 0;
});
const imported = await container.prisma.threadMessage.findMany({
    where: { thread: { source: 'DRAGORY' }, idLegacy: { not: null } },
    select: {
        id: true,
        idThread: true,
        idLegacy: true,
        attachments: { select: { id: true } },
    },
});

const importedByLegacyId = new Map(imported.map((row) => [row.idLegacy!, row]));
const allAttachments = (
    messagesWithAttachments.map((message) => {
        const attachments = (JSON.parse(message.attachments!) as string[]).filter((url) => {
            const data = parseAttachmentUrl(url);
            const row = importedByLegacyId.get(String(message.id));
            const alreadySaved = row?.attachments.some((attachment) => attachment.id === data?.id) ?? false;

            return data && !alreadySaved;
        });

        return [message.id, [...new Set(attachments)]];
    }) as [number, string[]][]
).filter(([, urls]) => urls.length > 0);

const allAttachmentURLs = [...new Set([...allAttachments.map(([, urls]) => urls)].flat())];
const attachmentMap = new Map<string, string>();

console.log(`Found ${allAttachmentURLs.length} attachment${allAttachmentURLs.length > 1 ? 's' : ''}.`);
console.log('Refreshing attachments...');

while (allAttachmentURLs.length > 0) {
    const chunk = allAttachmentURLs.splice(0, Math.min(allAttachmentURLs.length, 50));
    const response = (await client.rest
        .post('/attachments/refresh-urls', { body: { attachment_urls: chunk } })
        .catch((error) => {
            console.error(error);
            return null;
        })) as { refreshed_urls: { original: string; refreshed: string }[] } | null;

    if (!response?.refreshed_urls) {
        console.warn('Attachment chunk could not be refreshed:', response);
        continue;
    }

    for (const refreshedURL of response.refreshed_urls) {
        attachmentMap.set(refreshedURL.original, refreshedURL.refreshed);
    }
}

await client.rest.agent?.close();

console.log('Attachments refreshed. Now saving them...');

for (let i = 0; i < allAttachments.length; i++) {
    const [threadMessageId, urls] = allAttachments[i];
    const message = importedByLegacyId.get(String(threadMessageId));
    const progress = `${(i + 1).toString().padStart(threads.length.toString().length, '0')}/${threads.length}`;
    const percent = `${Math.floor(((i + 1) / threads.length) * 100)
        .toString()
        .padStart(3, '0')}%`;

    if (!message) {
        continue;
    }

    const attachments = (
        await Promise.all(
            urls.map(async (url) => {
                const data = parseAttachmentUrl(url);

                if (!data) {
                    return null;
                }

                const metadata = await saveAttachment(message.idThread, {
                    id: data.id,
                    name: data.name,
                    url: attachmentMap.get(url) ?? url,
                });

                if (!metadata) {
                    return null;
                }

                return { ...metadata, idThreadMessage: message.id };
            }),
        )
    ).filter((row) => row !== null && row !== undefined);

    if (attachments.length < 1) {
        continue;
    }

    console.log(
        `${progress} (${percent}): Saving ${attachments.length} attachment${attachments.length > 1 ? 's' : ''} for thread ${message.idThread}, message ${message.id}.`,
    );

    await container.prisma.threadAttachment.createMany({ data: attachments, skipDuplicates: true });
}

console.log('Done saving attachments!');
console.log(`Done migrating data from Dragory's modmail.`);

await client.destroy();
await container.prisma.$disconnect();
process.exit(0);
