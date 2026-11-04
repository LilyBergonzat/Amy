import { type Context, type Next } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { container } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v10';
import { MINUTE, SECOND, YEAR } from '../../lib/utils/datetime.js';
import { respondForbidden, respondUnauthorized, respondUnavailable } from '../../lib/WebService.js';

const setCookie = (c: Context, name: string, value: string, options?: Parameters<typeof setSignedCookie>[4]) => {
    return setSignedCookie(c, name, value, process.env.SECRET, {
        maxAge: YEAR / SECOND,
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.WEB_BASE_URL.startsWith('https'),
        ...options,
    });
};

const getCookie = (c: Context, name: string) => {
    return getSignedCookie(c, process.env.SECRET, name);
};

const redirectToDiscordAuth = async (c: Context) => {
    const url = new URL(c.req.url);
    await setCookie(c, 'go-back-to', `${url.pathname}${url.search}`, { maxAge: (10 * MINUTE) / SECOND });

    return c.redirect('/discord-redirect');
};

export const postDiscordAuthMiddleware = async (c: Context) => {
    const user = c.get('user-discord');

    if (!user || !user.id) {
        return respondUnauthorized(c);
    }

    await setCookie(c, 'discord_user', user.id, { maxAge: YEAR / SECOND });

    const redirectTo = await getCookie(c, 'go-back-to');

    if (redirectTo) {
        deleteCookie(c, 'go-back-to');
    }

    return c.redirect(redirectTo || '/');
};

export const discordLoggedInMiddleware = async (c: Context, next: Next) => {
    const userId = await getCookie(c, 'discord_user');

    if (!userId) {
        return redirectToDiscordAuth(c);
    }

    if (!container.client.isReady()) {
        return respondUnavailable(c);
    }

    const guild = await container.settings.getInboxServer();
    const category = await container.settings.getInboxCategory();

    if (!guild || !category) {
        return respondUnavailable(c);
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    const allowed = member !== null && category.permissionsFor(member).has(PermissionFlagsBits.ViewChannel);

    if (!allowed) {
        return respondForbidden(c);
    }

    return next();
};
