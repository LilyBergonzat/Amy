import { container } from '@sapphire/framework';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ChannelType } from 'discord-api-types/v10';
import type { GuildMember } from 'discord.js';

type ScalarMap = {
    string: string;
    number: number;
    boolean: boolean;
};

type ScalarName = keyof ScalarMap;

const schema = {
    prefix: 'string',
    'inbox-server': 'string',
    'inbox-category': 'string',
    'log-channel': 'string',
    'anonymous-by-default': 'boolean',
    'anonymous-display-name': 'string',
    'new-thread-ping': 'string',
    'new-thread-message': 'string',
    'new-thread-user-confirm-message': 'string',
    'user-message-reaction': 'string',
    'snippet-prefix': 'string',
} as const satisfies Record<string, ScalarName>;

type Schema = typeof schema;
export type Key = keyof Schema;
type ValueOf<K extends Key> = ScalarMap[Schema[K]];

export const settingKeys = Object.keys(schema) as unknown as Key[];

export const settingNames = {
    prefix: 'Prefix',
    'inbox-server': 'Inbox server',
    'inbox-category': 'Inbox category',
    'log-channel': 'Log channel',
    'anonymous-by-default': 'Post as a team by default',
    'anonymous-display-name': 'Team name',
    'new-thread-ping': 'New thread ping',
    'new-thread-message': 'New thread message',
    'new-thread-user-confirm-message': 'User-started-conversation confirmation message',
    'user-message-reaction': 'Reaction for relayed user messages',
    'snippet-prefix': 'Prefix for snippets',
} as const satisfies Record<Key, string>;

export const requiredSettings: Partial<Key[]> = [
    'prefix',
    'inbox-server',
    'inbox-category',
    'log-channel',
    'user-message-reaction',
];

const casters: { [K in ScalarName]: (raw: unknown) => ScalarMap[K] } = {
    string: (raw) => String(raw),
    number: (raw) => Number(raw),
    boolean: (raw) => raw === true || raw === 'true' || raw === '1' || raw === 1,
};

function castScalar<T extends ScalarName>(type: T, raw: unknown): ScalarMap[T] | null {
    return raw === null ? null : (casters[type](raw) as ScalarMap[T]);
}

function getSummaryValue(value: string | null) {
    return (
        value ?
            value.length > 21 ?
                `${value.slice(0, 20)}… (${value.length} character${value.length > 1 ? 's' : ''})`
            :   value
        :   null
    );
}

export function formatSettingForMessage<K extends Key>(
    key: K,
    value: ValueOf<K> | string | null,
    summary: boolean = false,
): string | null {
    if (value === null) {
        return '<N/A>';
    }

    switch (key) {
        case 'prefix':
        case 'snippet-prefix':
            return `\`${value}\``;
        case 'inbox-server':
            return container.client.guilds.cache.get(String(value))?.name ?? 'Invalid server';
        case 'inbox-category':
            return `<#${value}>`;
        case 'log-channel':
            return `<#${value}>`;
        case 'anonymous-by-default':
            return value ? 'yes' : 'no';
        case 'new-thread-ping':
            return `<@&${value}>`;
        case 'new-thread-message':
        case 'new-thread-user-confirm-message':
            return summary ? getSummaryValue(String(value)) : String(value);
        default:
            return String(value);
    }
}

export function sanitizeSettingValue<K extends Key>(key: K, value: ValueOf<K> | string): ValueOf<K> | string {
    switch (key) {
        case 'prefix':
        case 'snippet-prefix':
        case 'user-message-reaction':
            return String(value).trim();

        default:
            return value;
    }
}

export async function validateSettingValue<K extends Key>(key: K, value: ValueOf<K> | string | null): Promise<boolean> {
    if (value === null && requiredSettings.includes(key)) {
        return false;
    }

    switch (key) {
        case 'prefix':
            return String(value).length > 0 && value !== (await container.settings.get('snippet-prefix'));

        case 'snippet-prefix':
            return String(value).length > 0 && value !== (await container.settings.get('prefix'));

        case 'user-message-reaction':
            return /^\p{RGI_Emoji}$/v.test(String(value)) || /^<a?:[a-zA-Z0-9_\-]+:\d{17,20}>$/v.test(String(value));

        default:
            return true;
    }
}

function addSettingsOption(key: Key, builder: SlashCommandSubcommandBuilder) {
    switch (key) {
        case 'prefix':
            builder.addStringOption((option) => option.setName(key).setDescription('The prefix for message commands'));
            break;

        case 'inbox-server':
            builder.addStringOption((option) =>
                option.setName(key).setDescription('The server ID in which to display incoming messages'),
            );
            break;

        case 'inbox-category':
            builder.addChannelOption((option) =>
                option
                    .setName(key)
                    .setDescription('The category in which to display incoming messages')
                    .addChannelTypes(ChannelType.GuildCategory),
            );
            break;

        case 'log-channel':
            builder.addChannelOption((option) =>
                option
                    .setName(key)
                    .setDescription('The channel in which to send logs (i.e. closed threads)')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread),
            );
            break;

        case 'anonymous-by-default':
            builder.addBooleanOption((option) =>
                option
                    .setName(key)
                    .setDescription('Whether messages sent by the staff should be anonymous by default or not'),
            );
            break;

        case 'anonymous-display-name':
            builder.addStringOption((option) =>
                option.setName(key).setDescription('The name to display when staff sends messages anonymously'),
            );
            break;

        case 'new-thread-ping':
            builder.addRoleOption((option) =>
                option.setName(key).setDescription('Which role to ping when a new thread is created'),
            );
            break;

        case 'new-thread-message':
            builder.addStringOption((option) =>
                option.setName(key).setDescription('The message to alert mods that a new thread was created'),
            );
            break;

        case 'new-thread-user-confirm-message':
            builder.addStringOption((option) =>
                option.setName(key).setDescription('The message that will be sent to users who start a new thread'),
            );
            break;

        case 'user-message-reaction':
            builder.addStringOption((option) =>
                option.setName(key).setDescription('The emoji that will be used to react to relayed user messages'),
            );
            break;

        case 'snippet-prefix':
            builder.addStringOption((option) => option.setName(key).setDescription('The prefix for snippets'));
            break;

        default:
            // noinspection UnnecessaryLocalVariableJS
            const unhandled: never = key;
            throw new Error(`Unhandled setting key: ${unhandled}`);
    }
}

export function addSettingsOptions(builder: SlashCommandSubcommandBuilder) {
    for (const key of settingKeys) {
        addSettingsOption(key as Key, builder);
    }

    return builder;
}

export class SettingsService {
    private static instance: SettingsService;

    private cache: Map<Key, string | null> = new Map<Key, string | null>();

    constructor() {
        if (SettingsService.instance) {
            return SettingsService.instance;
        }

        SettingsService.instance = this;
    }

    public async getRaw(key: Key): Promise<string | null> {
        if (!this.cache.has(key)) {
            const data = await container.prisma.setting.findFirst({ where: { key } });

            this.cache.set(key, data?.value ?? null);
        }

        return this.cache.get(key)!;
    }

    public async get<K extends Key>(key: K): Promise<ValueOf<K> | null> {
        return castScalar(schema[key], await this.getRaw(key));
    }

    public async getAllRaw(): Promise<Record<Key, string>> {
        const result = {} as Record<Key, string>;

        await Promise.all(
            settingKeys.map(async (key) => {
                const value = await this.getRaw(key);

                if (value !== null) {
                    result[key] = value;
                }
            }),
        );

        return result;
    }

    public async set<K extends Key>(key: K, value: ValueOf<K> | string) {
        const raw = String(value);

        await container.prisma.setting.upsert({
            update: { value: raw },
            where: { key },
            create: { key, value: raw },
        });

        this.cache.set(key, raw);
    }

    public async unset(key: Key) {
        await container.prisma.setting.deleteMany({ where: { key } });
        this.cache.set(key, null);
    }

    public async getInboxServer() {
        const inboxServer = await this.get('inbox-server');

        if (!inboxServer) {
            console.warn('Inbox server not configured');
            return null;
        }

        return container.client.guilds.cache.get(inboxServer);
    }

    public async getInboxCategory() {
        const inboxServer = await this.getInboxServer();
        const inboxCategory = await this.get('inbox-category');

        if (!inboxServer || !inboxCategory) {
            console.warn('Bot not properly configured.');
            return null;
        }

        const category = await inboxServer.channels.fetch(inboxCategory).catch(() => null);

        if (!category || category.type !== ChannelType.GuildCategory) {
            console.warn('Could not retrieve the inbox category.');
            return null;
        }

        return category;
    }

    public async getLogChannel() {
        const inboxServer = await this.getInboxServer();
        const logChannelId = await this.get('log-channel');

        if (!inboxServer || !logChannelId) {
            console.warn('Bot not properly configured.');
            return null;
        }

        const logChannel = await inboxServer.channels.fetch(logChannelId);

        if (!logChannel || !logChannel.isSendable()) {
            console.warn('Could not retrieve the log channel.');
            return null;
        }

        return logChannel;
    }

    public async isAnonymous(override?: boolean) {
        return override !== undefined ? override : Boolean(await this.get('anonymous-by-default'));
    }

    public async getStaffDisplayName(author: GuildMember, isAnonymousOverride?: boolean) {
        return (await this.isAnonymous(isAnonymousOverride)) ? this.get('anonymous-display-name') : author.displayName;
    }

    public async getPrefix() {
        return (await this.get('prefix')) ?? `${container.client.user!} `;
    }

    public async getPrefixes() {
        return [await this.get('prefix'), ...(await this.getSnippetPrefixes())]
            .filter((p) => p !== null)
            .sort(this.sortPrefixes);
    }

    public async getSnippetPrefixes() {
        const snippetPrefix = await this.get('snippet-prefix');
        const prefix = await this.get('prefix');
        const automaticSnippetPrefix = prefix ? `${prefix}${prefix}` : null;
        const snippetPrefixes = [];

        if (snippetPrefix && snippetPrefix !== prefix) {
            snippetPrefixes.push(snippetPrefix);
        }

        if (automaticSnippetPrefix && !snippetPrefixes.includes(automaticSnippetPrefix)) {
            snippetPrefixes.push(automaticSnippetPrefix);
        }

        return snippetPrefixes.sort(this.sortPrefixes);
    }

    private sortPrefixes(a: string, b: string) {
        return a.length > b.length ? -1 : 1;
    }
}
