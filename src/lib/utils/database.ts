import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';

export function createPrisma() {
    const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
    return new PrismaClient({ adapter });
}
