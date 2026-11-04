import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type MessageCommandDeniedPayload, type UserError } from '@sapphire/framework';
import { messageCommandDeniedHandler } from '../lib/SnippetService.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCommandDenied,
})
export class MessageCommandDeniedListener extends Listener {
    public override async run(error: UserError, payload: MessageCommandDeniedPayload) {
        const isSnippet = await messageCommandDeniedHandler(error, payload);

        if (isSnippet || Reflect.get(Object(error.context), 'silent')) {
            return;
        }

        await payload.message.reply(error.message);
    }
}
