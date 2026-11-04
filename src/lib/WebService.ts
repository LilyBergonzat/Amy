import { type Context, Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve, type ServerType } from '@hono/node-server';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { discordAuth } from '@hono/oauth-providers/discord';
import { postDiscordAuthMiddleware, discordLoggedInMiddleware } from '../web/middlewares/discord.js';
import { TranscriptService } from './threads/TranscriptService.js';
import { Transcript } from '../web/views/Transcript.js';
import { NotFound } from '../web/views/NotFound.js';
import { container } from '@sapphire/framework';
import { openAsBlob } from 'node:fs';
import { isGalleryMedia } from './utils/discord.js';
import * as fs from 'node:fs';

export const respondUnauthorized = (c: Context) => c.text('Unauthorized', 401);
export const respondForbidden = (c: Context) => c.text('Forbidden', 403);
export const respondNotFound = (c: Context) => c.notFound();
export const respondUnavailable = (c: Context) => c.text('Service unavailable', 503);

export class WebService {
    private static instance: WebService;

    private app!: Hono;
    private server?: ServerType;

    public constructor() {
        if (WebService.instance) {
            return WebService.instance;
        }

        this.init();
        WebService.instance = this;
    }

    public get port() {
        return Number(process.env.WEB_PORT ?? 8080);
    }

    public destroy() {
        return new Promise<void>((resolve, reject) => {
            this.server?.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    public url(path: string) {
        return `${process.env.WEB_BASE_URL.replace(/\/$/v, '')}/${path.replace(/^\//v, '')}`;
    }

    private init() {
        this.app = new Hono();

        this.configureMiddlewares();
        this.configureRoutes();

        this.server = serve({ fetch: this.app.fetch, port: this.port });
    }

    private configureMiddlewares() {
        this.app.use('/*', serveStatic({ root: './public' }));
        this.app.use(trimTrailingSlash());
        this.app.use('/stickers/*', serveStatic({ root: './assets' }));
        this.app.use('/thread/*', discordLoggedInMiddleware);
        this.app.use(
            '/discord-redirect',
            discordAuth({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                scope: ['identify'],
                redirect_uri: this.url(`/discord-redirect`),
            }),
            postDiscordAuthMiddleware,
        );
    }

    private configureRoutes() {
        this.app.get('/thread/:id', async (c) => {
            const id = c.req.param('id');
            const service = id ? await TranscriptService.fromThreadId(id) : null;

            if (!service) {
                return respondNotFound(c);
            }

            return c.html(Transcript({ service }));
        });

        this.app.get('/thread/:id/attachment/:attachmentId', async (c) => {
            const id = c.req.param('id');
            const attachmentId = c.req.param('attachmentId');
            const threadAttachment = await container.prisma.threadAttachment.findUnique({
                where: { id: attachmentId },
                include: { message: true },
            });

            const path = `data/attachments/${threadAttachment?.message.idThread}/${threadAttachment?.id}`;

            if (!threadAttachment || threadAttachment.message.idThread !== id || !fs.existsSync(path)) {
                return respondNotFound(c);
            }

            return c.body((await openAsBlob(path)).stream(), {
                headers: {
                    'Content-Type': threadAttachment.contentType ?? 'application/octet-stream',
                    'Content-Length': String(threadAttachment.size),
                    'X-Content-Type-Options': 'nosniff',
                    'Content-Disposition': `${isGalleryMedia(threadAttachment.contentType) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(threadAttachment.name)}`,
                },
            });
        });

        this.app.get('/', (c) => c.text('Hello world!'));

        this.app.notFound((c) => {
            c.status(404);
            return c.html(NotFound());
        });
    }
}
