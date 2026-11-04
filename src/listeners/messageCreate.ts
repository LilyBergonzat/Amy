import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { MessageRelayService } from '../lib/threads/MessageRelayService.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
})
export class MessageCreateListener extends Listener {
    public override async run(message: Message) {
        await new MessageRelayService().messageCreateHandler(message);
    }
}
