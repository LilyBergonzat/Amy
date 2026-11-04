import {
    container,
    type MessageCommandDeniedPayload,
    type UnknownMessageCommandPayload,
    type UserError,
} from '@sapphire/framework';
import type { Snippet } from '../generated/prisma/client.js';
import { getCommandMention } from './utils/mention.js';
import { SNIPPET_PRECONDITION_ERROR_IDENTIFIER } from '../preconditions/snippetPrecondition.js';
import type { Message } from 'discord.js';

export const SNIPPET_NAME_MAX_LENGTH = 80;
export const SNIPPET_CONTENT_MAX_LENGTH = 4000;
export const SNIPPET_NAME_REGEX = /^[a-z0-9_\-]+$/v;

export async function fetchSnippet(trigger: string) {
    return container.prisma.snippet.findFirst({
        where: { aliases: { some: { alias: trigger.toLowerCase() } } },
        include: { aliases: true },
    });
}

export async function createSnippet(name: string, content: string): Promise<Snippet> {
    return container.prisma.snippet.create({
        data: {
            content,
            createdAt: new Date(),
            aliases: { create: [{ alias: name, isPrimary: 'PRIMARY' }] },
        },
    });
}

export async function editSnippet(id: number, content?: string | null): Promise<void> {
    if (!content) {
        return;
    }

    await container.prisma.snippet.update({
        where: { id },
        data: {
            ...(content ? { content } : {}),
        },
    });
}

export async function deleteSnippet(id: number): Promise<void> {
    await container.prisma.snippet.delete({ where: { id } });
}

export async function addSnippetAlias(idSnippet: number, alias: string, isPrimary: boolean = false) {
    // noinspection ES6MissingAwait
    await container.prisma.$transaction([
        ...(isPrimary ?
            [
                container.prisma.snippetAlias.updateMany({
                    where: { idSnippet },
                    data: { isPrimary: null },
                }),
            ]
        :   []),
        container.prisma.snippetAlias.create({
            data: {
                idSnippet,
                alias,
                isPrimary: isPrimary ? 'PRIMARY' : null,
            },
        }),
    ]);
}

export async function editSnippetAlias(idSnippet: number, idAlias: number, alias: string, isPrimary?: boolean) {
    const snippetAlias = await container.prisma.snippetAlias.findUniqueOrThrow({ where: { id: idAlias } });

    if (snippetAlias.isPrimary && isPrimary === false) {
        throw new Error(
            `Removing this snippet's alias' primary status would leave this snippet with no primary alias, which is impossible.`,
        );
    }

    if (isPrimary) {
        // noinspection ES6MissingAwait
        await container.prisma.$transaction([
            container.prisma.snippetAlias.updateMany({
                where: { idSnippet },
                data: { isPrimary: null },
            }),
            container.prisma.snippetAlias.update({
                where: { id: idAlias },
                data: { alias, isPrimary: 'PRIMARY' },
            }),
        ]);
    } else {
        await container.prisma.snippetAlias.update({
            where: { id: idAlias },
            data: { alias },
        });
    }
}

export async function deleteSnippetAlias(idAlias: number) {
    const snippetAlias = await container.prisma.snippetAlias.findUniqueOrThrow({ where: { id: idAlias } });

    if (snippetAlias.isPrimary) {
        throw new Error(`You cannot delete a snippet's primary alias`);
    }

    await container.prisma.snippetAlias.delete({ where: { id: snippetAlias.id } });
}

export async function unknownMessageCommandHandler({ message }: UnknownMessageCommandPayload) {
    await snippetCommandHandler(message);
}

export async function messageCommandDeniedHandler(error: UserError, { message }: MessageCommandDeniedPayload) {
    if (error.identifier !== SNIPPET_PRECONDITION_ERROR_IDENTIFIER) {
        return;
    }

    return await snippetCommandHandler(message);
}

async function snippetCommandHandler(message: Message) {
    if (message.partial) {
        await message.fetch();
    }

    const { channel, guildId } = message;

    if (!channel || !guildId) {
        return false;
    }

    const prefix = (await container.settings.getSnippetPrefixes()).find((prefix) => message.content.startsWith(prefix));

    if (!prefix) {
        return false;
    }

    const rest = message.content.slice(prefix.length).trimStart();
    const [snippetName] = rest.split(/\s/v);
    const parameters = rest.slice(snippetName.length);
    const snippet = await fetchSnippet(snippetName);
    const thread = await container.threads.getThreadByChannel(channel.id);

    if (!snippet) {
        if (thread) {
            await message.reply(
                `This snippet does not seem to exist. Try using the ${getCommandMention('snippet')} command, it should be easier to find what you are looking for!`,
            );
        }

        return true;
    }

    if (!thread) {
        return true;
    }

    const args = await container.stores
        .get('commands')
        .get('reply')
        ?.messagePreParse(message, parameters, { prefix, commandName: snippetName, commandPrefix: prefix });

    if (!args) {
        return true;
    }

    const anonymousFlagSet = args.getFlags('anonymous', 'a');
    const notAnonymousFlagSet = args.getFlags('not-anonymous', 'n');

    if (anonymousFlagSet && notAnonymousFlagSet) {
        await message.reply('You cannot request for a reply to be both anonymous and not anonymous.');
        return true;
    }

    await container.threads.sendMessageFromStaff(
        thread,
        snippet.content,
        message.member!,
        message,
        anonymousFlagSet || notAnonymousFlagSet ? anonymousFlagSet : undefined,
    );

    return true;
}
