import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({
    once: true,
    event: 'clientReady',
})
export class ClientReadyListener extends Listener {
    public override async run() {
        const { client } = this.container;

        this.container.logger.info(`Logged in as ${client.user!.tag} (${client.user!.id})`);
    }
}
