import { Listener, type MessageCommandErrorPayload, UserError } from '@sapphire/framework';
import * as Sentry from '@sentry/node';

export class MessageCommandErrorListener extends Listener {
    public override async run(error: Error, context: MessageCommandErrorPayload) {
        const content =
            error instanceof UserError ?
                error.message
            :   `Something went wrong. Please try again later. (Error ID: ${crypto.randomUUID().split('-')[0]})`;

        if (!(error instanceof UserError)) {
            this.container.logger.error(`Command error in ${context.command.name}:`, error);
            Sentry.captureException(error, {
                extra: {
                    command: context.command.name,
                    userId: context.message.author.id,
                    guildId: context.message.guildId,
                },
            });
        }

        await context.message.reply({ content });
    }
}
