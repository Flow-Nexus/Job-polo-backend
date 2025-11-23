import { PrismaClient } from '@prisma/client';
import { createPostgresAdapter } from '@prisma/adapter-postgresql';

const { DATABASE_URL, PRISMA_ACCELERATE_URL } = process.env;
if (!DATABASE_URL && !PRISMA_ACCELERATE_URL) {
  throw new Error('Set DATABASE_URL or PRISMA_ACCELERATE_URL in your environment.');
}

const prisma = new PrismaClient({
  adapter: DATABASE_URL ? createPostgresAdapter({ url: DATABASE_URL }) : undefined,
});

export default prisma;