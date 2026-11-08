import { container } from '@sapphire/framework';
import { getCommandName } from '../CommandService.js';
import { computeUserData, type UserData } from '../threads/ThreadService.js';
import type { RoleColors } from 'discord.js';

export function getCommandByName(name: string) {
    const rootName = name.split(' ')[0];

    return (
        container.client.application!.commands.cache.find((command) => command.name === getCommandName(rootName)) ??
        container.client.application!.commands.cache.find((command) => command.name === rootName)
    );
}

export function getCommandMention(name: string): string {
    const command = getCommandByName(name);

    return command ? `</${command.name}:${command.id}>` : `\`/${name}\``;
}

export type MentionTypes = {
    user: UserData;
    role: { id: string; name: string; colours: RoleColors };
    channel: { id: string; name: string };
};

export type MentionData = { [K in keyof MentionTypes]: Record<string, MentionTypes[K]> };

type MentionComputers = {
    [K in keyof MentionTypes]: {
        regex: RegExp;
        buildData: (id: string) => Promise<MentionTypes[K] | null>;
    };
};

export async function buildMentionsData(content: string | null | undefined): Promise<MentionData> {
    const guild = await container.settings.getInboxServer();
    const data = {
        user: {} as Record<string, UserData>,
        role: {} as Record<string, { id: string; name: string; colours: RoleColors }>,
        channel: {} as Record<string, { id: string; name: string }>,
    };

    if (!content || !guild) {
        return data;
    }

    const computeList: MentionComputers = {
        user: {
            regex: /<@!?(?<id>\d{17,19})>/gv,
            buildData: async (id) => {
                const user = await container.client.users.fetch(id).catch(() => null);

                if (!user) {
                    return null;
                }

                return computeUserData(user);
            },
        },
        role: {
            regex: /<@&(?<id>\d{17,19})>/gv,
            buildData: async (id) => {
                const role = await guild.roles.fetch(id).catch(() => null);

                if (!role) {
                    return null;
                }

                return { id: role.id, name: role.name, colours: role.colors };
            },
        },
        channel: {
            regex: /<#(?<id>\d{17,19})>/gv,
            buildData: async (id) => {
                const channel = await guild.channels.fetch(id).catch(() => null);

                if (!channel) {
                    return null;
                }

                return { id: channel.id, name: channel.name };
            },
        },
    };

    for (const type in computeList) {
        const compute = computeList[type as keyof typeof computeList];
        let match;

        do {
            match = compute.regex.exec(content);
            const id = match?.groups?.id;

            if (!id || id in data[type as keyof typeof data]) {
                continue;
            }

            const entityData = await compute.buildData(id);

            if (!entityData) {
                continue;
            }

            data[type as keyof typeof data][id] = entityData;
        } while (match);
    }

    return data;
}
