import { MINUTE } from './utils/datetime.js';
import { container } from '@sapphire/framework';
import { ThreadOpen } from '../generated/prisma/enums.js';

export class ScheduledCloseService {
    private static instance: ScheduledCloseService;

    private interval: NodeJS.Timeout | null = null;
    private running = false;

    public constructor() {
        if (ScheduledCloseService.instance) {
            return ScheduledCloseService.instance;
        }

        ScheduledCloseService.instance = this;
    }

    public start() {
        this.interval ??= setInterval(() => void this.run(), MINUTE);
        void this.run();
    }

    public stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private async run() {
        if (this.running) {
            return;
        }

        this.running = true;

        try {
            const threads = await container.prisma.thread.findMany({
                where: { isOpen: ThreadOpen.OPEN, scheduledClose: { lte: new Date() } },
            });

            for (const thread of threads) {
                await container.threads.closeThread(thread).catch((error) => container.logger.error(error));
            }
        } finally {
            this.running = false;
        }
    }
}
