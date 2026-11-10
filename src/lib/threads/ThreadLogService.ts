import type { Thread } from '../../generated/prisma/client.js';
import { container } from '@sapphire/framework';

export class ThreadLogService {
    private static instance: ThreadLogService;

    public constructor() {
        if (ThreadLogService.instance) {
            return ThreadLogService.instance;
        }

        ThreadLogService.instance = this;
    }

    public async logClosedThread(thread: Thread, channelId?: string | null) {
        const logChannel = await container.settings.getLogChannel();

        if (!logChannel) {
            console.warn(`Tried to close thread ${thread.id} and failed: could not fetch log channel.`);
            return;
        }

        await logChannel.send(
            `Thread ${thread.id} to <@${thread.idRecipient}> closed (opened by <@${thread.idOpenedBy}>).\n<${container.web.url(`/thread/${thread.id}`)}>${channelId ? `\n-# Channel id: ${channelId}` : ''}`,
        );
    }
}
