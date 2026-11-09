import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { MessageRelayService } from '../lib/threads/MessageRelayService.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageUpdate,
})
export class MessageUpdateListener extends Listener {
    public override async run(_: Message, newMessage: Message) {
        await new MessageRelayService().messageUpdateHandler(newMessage);
    }
}
