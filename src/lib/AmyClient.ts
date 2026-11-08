import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { PrismaClient } from '../generated/prisma/client.js';
import { container, SapphireClient } from '@sapphire/framework';
import type { ClientOptions } from 'discord.js';
import { SettingsService } from './SettingsService.js';
import { ThreadService } from './threads/ThreadService.js';
import { WebService } from './WebService.js';
import { WizardService } from './WizardService.js';
import { createPrisma } from './utils/database.js';

export class AmyClient extends SapphireClient {
    public constructor(options: ClientOptions) {
        super(options);

        container.settings = new SettingsService();
        container.threads = new ThreadService();
    }

    public override fetchPrefix = async () => {
        return container.settings.getPrefixes();
    };

    public override async login(token?: string) {
        const modulesUrl = new URL('../modules/', import.meta.url);

        if (existsSync(modulesUrl)) {
            this.logger.debug('Loading modules');
            const modules = await readdir(modulesUrl);
            this.logger.debug(`Found ${modules.length} modules: ${modules.join(', ')}`);

            for (const module of modules) {
                this.stores.registerPath(new URL(`../modules/${module}/`, import.meta.url));
                this.logger.info(`Loaded module ${module}`);
            }
        }

        await WizardService.init();

        container.prisma = createPrisma();
        await container.prisma.$connect();
        this.logger.info('Connected to the database');

        this.logger.info('Starting web server...');
        container.web = new WebService();
        this.logger.info(`Web server started on port ${container.web.port}.`);

        this.logger.info('Logging in to Discord');
        return super.login(token);
    }

    public override async destroy() {
        await container.web?.destroy().catch(this.logger.error);
        await container.prisma?.$disconnect().catch(this.logger.error);
        return super.destroy();
    }
}

declare module '@sapphire/pieces' {
    interface Container {
        prisma: PrismaClient;
        settings: SettingsService;
        threads: ThreadService;
        web: WebService;
    }
}
