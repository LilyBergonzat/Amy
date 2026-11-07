import { container } from '@sapphire/framework';
import { DiscordSnowflake } from '@sapphire/snowflake';
import { MessageRelayService } from './MessageRelayService.js';
import { DAY } from '../utils/datetime.js';
import { Collection, type Message } from 'discord.js';

let catchingUp = false;

async function getRecipientList() {
    return (
        await container.prisma.thread.findMany({
            distinct: ['idRecipient'],
            select: {
                idRecipient: true,
                openedAt: true,
                messages: {
                    where: { idStaff: null },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { openedAt: 'desc' },
            where: { OR: [{ closedAt: null }, { closedAt: { gte: new Date(Date.now() - 30 * DAY) } }] },
        })
    ).map((row) => ({
        userId: row.idRecipient,
        afterSnowflake: row.messages[0]?.idMessage ?? DiscordSnowflake.generate({ timestamp: row.openedAt }).toString(),
    }));
}

async function catchUpUser({ userId, afterSnowflake }: { userId: string; afterSnowflake: string }) {
    const user = await container.client.users.fetch(userId).catch(() => null);
    const channel = await user?.createDM().catch(() => null);

    if (!channel) {
        return;
    }

    let cursor = afterSnowflake;
    let lastMessages;

    do {
        lastMessages = (
            await channel.messages.fetch({ after: cursor, limit: 100 }).catch(() => new Collection<string, Message>())
        ).sort((a, b) => (BigInt(a.id) - BigInt(b.id) < 0 ? -1 : 1));

        for (const message of lastMessages.filter((m) => m.author.id === userId).values()) {
            const handledCount = await container.prisma.threadMessage
                .count({ where: { idMessage: message.id } })
                .catch(() => 0);

            if (handledCount > 0) {
                continue;
            }

            await new MessageRelayService()
                .messageCreateHandler(message)
                .catch((error) => container.logger.error(error));
        }

        cursor = lastMessages.lastKey() ?? cursor;
    } while (lastMessages.size === 100);
}

export async function catchUp() {
    if (catchingUp) {
        return;
    }

    catchingUp = true;

    const list = await getRecipientList();

    container.logger.info(`Catching up with ${list.length} users...`);
    await Promise.all(list.map(catchUpUser)).catch((error) => container.logger.error(error));
    container.logger.info(`Caught up with ${list.length} users.`);

    catchingUp = false;
}
