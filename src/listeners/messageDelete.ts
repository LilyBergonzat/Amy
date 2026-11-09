import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { MessageRelayService } from '../lib/threads/MessageRelayService.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageDelete,
})
export class MessageDeleteListener extends Listener {
    public override async run(message: Message) {
        await new MessageRelayService().messageDeleteHandler(message);
    }
}
