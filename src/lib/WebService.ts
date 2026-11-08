import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve, type ServerType } from '@hono/node-server';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { discordAuth } from '@hono/oauth-providers/discord';
import { postDiscordAuthMiddleware, discordLoggedInMiddleware, discordLogout } from '../web/middlewares/discord.js';
import { TranscriptService } from './threads/TranscriptService.js';
import { Transcript } from '../web/views/Transcript.js';
import { container } from '@sapphire/framework';
import { openAsBlob } from 'node:fs';
import { isGalleryMedia } from './utils/discord.js';
import * as fs from 'node:fs';
import { Forbidden, InternalServerError, NotFound, ServiceUnavailable, Unauthorized } from '../web/views/Error.js';
import { MINUTE, SECOND, YEAR } from './utils/datetime.js';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { ThreadSource } from '../generated/prisma/enums.js';

export const setCookie = (c: Context, name: string, value: string, options?: Parameters<typeof setSignedCookie>[4]) => {
    return setSignedCookie(c, name, value, process.env.SECRET, {
        maxAge: YEAR / SECOND,
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.WEB_BASE_URL.startsWith('https'),
        ...options,
    });
};

export const getCookie = (c: Context, name: string) => {
    return getSignedCookie(c, process.env.SECRET, name);
};

export const setGoBackToCookie = (c: Context) => {
    const url = new URL(c.req.url);
    return setCookie(c, 'go-back-to', `${url.pathname}${url.search}`, { maxAge: (10 * MINUTE) / SECOND });
};

export const redirectToGoBackTo = async (c: Context) => {
    const redirectTo = await getCookie(c, 'go-back-to');

    if (redirectTo) {
        deleteCookie(c, 'go-back-to');
    }

    return c.redirect(redirectTo || '/');
};

export const respondUnauthorized = (c: Context) => c.html(Unauthorized(), 401);
export const respondForbidden = async (c: Context) => {
    await setGoBackToCookie(c);
    return c.html(Forbidden(), 403);
};
export const respondNotFound = (c: Context) => c.notFound();
export const respondUnavailable = (c: Context) => c.html(ServiceUnavailable(), 503);

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
        this.app.use('/logout', discordLogout);
    }

    private configureRoutes() {
        this.app.get('/thread/:id', async (c) => {
            const id = c.req.param('id');
            const service = await TranscriptService.fromThreadId(id);

            if (!service) {
                return respondNotFound(c);
            }

            return c.html(Transcript({ service }));
        });

        this.app.get('/logs/:id', async (c) => {
            const id = c.req.param('id');
            const thread = await container.prisma.thread.findUnique({
                where: {
                    source_idLegacy: {
                        idLegacy: id,
                        source: ThreadSource.DRAGORY,
                    },
                },
            });

            if (!thread) {
                return respondNotFound(c);
            }

            return c.redirect(`/thread/${thread.id}`);
        });

        this.app.get('/thread/:id/attachment/:attachmentId', async (c) => {
            const id = c.req.param('id');
            const attachmentId = c.req.param('attachmentId');
            const threadAttachment = await container.prisma.threadAttachment.findFirst({
                where: { id: attachmentId, message: { idThread: id } },
                include: { message: true },
            });

            const path = `data/attachments/${threadAttachment?.message.idThread}/${threadAttachment?.id}`;

            if (!threadAttachment || !fs.existsSync(path)) {
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

        this.app.notFound((c) => {
            c.status(404);
            return c.html(NotFound());
        });

        this.app.onError((error, c) => {
            if (error instanceof HTTPException) {
                return error.status === 401 ? respondUnauthorized(c) : error.getResponse();
            }

            container.logger.error(error);
            c.status(500);

            return c.html(InternalServerError());
        });
    }
}
