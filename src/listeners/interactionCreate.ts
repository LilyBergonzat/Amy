import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { Interaction } from 'discord.js';
import { WizardService } from '../lib/WizardService.js';

@ApplyOptions<Listener.Options>({
    event: Events.InteractionCreate,
})
export class InteractionCreateListener extends Listener {
    public override async run(interaction: Interaction) {
        await WizardService.interactionHandler(interaction);
    }
}
