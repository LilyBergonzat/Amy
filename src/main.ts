import process from 'node:process';
import '@sapphire/plugin-logger/register';
import { ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';
import * as Sentry from '@sentry/node';
import { IntentsBitField, Partials } from 'discord.js';
import 'dotenv-expand/config';
import { AmyClient } from './lib/AmyClient.js';

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? 'development',
        tracesSampleRate: 0,
    });
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    Sentry.captureException(error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    if (reason instanceof Error) {
        Sentry.captureException(reason);
    } else {
        Sentry.captureMessage(String(reason), 'error');
    }
});

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.Overwrite);

const client = new AmyClient({
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.GuildScheduledEvent,
        Partials.Message,
        Partials.Poll,
        Partials.PollAnswer,
        Partials.Reaction,
        Partials.SoundboardSound,
        Partials.ThreadMember,
        Partials.User,
    ],
    intents: new IntentsBitField([
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildExpressions,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.DirectMessageReactions,
        IntentsBitField.Flags.MessageContent,
    ]),
    loadMessageCommandListeners: true,
    loadDefaultErrorListeners: false,
    caseInsensitiveCommands: true,
    logger: {
        depth: 2,
    },
});

for (const event of ['SIGTERM', 'SIGINT']) {
    process.on(event, async () => {
        client.logger.info(`${event} signal received, shutting down...`);
        await client.destroy();
    });
}

try {
    await client.login();
} catch (error) {
    client.logger.error('Failed to start the bot:', error);
    Sentry.captureException(error);
    await client.destroy();
}

declare global {
    namespace NodeJS {
        interface ProcessEnv extends Dict<string> {
            DISCORD_TOKEN: string;
            DISCORD_CLIENT_ID: string;
            DISCORD_CLIENT_SECRET: string;
            DATABASE_USERNAME: string;
            DATABASE_PASSWORD: string;
            DATABASE_HOST: string;
            DATABASE_PORT: string;
            DATABASE_NAME: string;
            SENTRY_DSN: string;
            NODE_ENV: string;
            DATABASE_URL: string;
            WEB_PORT: string;
            WEB_BASE_URL: string;
            SECRET: string;
            COMMAND_PREFIX?: string;
            [key: `COMMAND_NAME_${string}`]: string | undefined;
            [key: `DISABLE_CONTEXT_MENU_${string}`]: string | undefined;
        }
    }
}
