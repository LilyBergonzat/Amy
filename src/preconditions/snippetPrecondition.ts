import { AllFlowsPrecondition } from '@sapphire/framework';
import type { Message } from 'discord.js';

export const SNIPPET_PRECONDITION_ERROR_IDENTIFIER = 'snippetPrefix';

export class SnippetPrecondition extends AllFlowsPrecondition {
    public constructor(context: AllFlowsPrecondition.LoaderContext, options: AllFlowsPrecondition.Options) {
        super(context, {
            ...options,
            position: 100,
        });
    }

    public override chatInputRun() {
        return this.ok();
    }

    public override contextMenuRun() {
        return this.ok();
    }

    public override async messageRun(message: Message) {
        const matched = (await this.container.settings.getPrefixes()).find((prefix) =>
            message.content.startsWith(prefix),
        );
        const snippetPrefixes = await this.container.settings.getSnippetPrefixes();

        if (matched && snippetPrefixes.includes(matched)) {
            return this.error({ identifier: SNIPPET_PRECONDITION_ERROR_IDENTIFIER });
        }

        return this.ok();
    }
}
