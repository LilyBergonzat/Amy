import { AllFlowsPrecondition } from '@sapphire/framework';
import { ChannelType, type Message } from 'discord.js';

export const STAFF_PRECONDITION_ERROR_IDENTIFIER = 'staff';

export class StaffPrecondition extends AllFlowsPrecondition {
    public constructor(context: AllFlowsPrecondition.LoaderContext, options: AllFlowsPrecondition.Options) {
        super(context, {
            ...options,
            position: 30,
        });
    }

    public override chatInputRun() {
        return this.ok();
    }

    public override contextMenuRun() {
        return this.ok();
    }

    public override async messageRun(message: Message) {
        if (message.partial) {
            await message.fetch();
        }

        const channel = message.guild ? await message.guild.channels.fetch(message.channelId) : null;
        let category = channel?.parent;

        while (category && category.type !== ChannelType.GuildCategory) {
            category = category.parent;
        }

        const allowed = category && category.id === (await this.container.settings.get('inbox-category'));

        return allowed ?
                this.ok()
            :   this.error({
                    identifier: STAFF_PRECONDITION_ERROR_IDENTIFIER,
                    context: { silent: true },
                });
    }
}
