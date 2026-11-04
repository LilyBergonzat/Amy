import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type UnknownMessageCommandPayload } from '@sapphire/framework';
import { unknownMessageCommandHandler } from '../lib/SnippetService.js';

@ApplyOptions<Listener.Options>({
    event: Events.UnknownMessageCommand,
})
export class UnknownMessageCommandListener extends Listener {
    public override run(payload: UnknownMessageCommandPayload) {
        void unknownMessageCommandHandler(payload);
    }
}
