// Seeds the fixed demo user (analyst-demo). This is what the front's
// auto-fill demo login button (Bloco 5) points at — same idea as
// deep-space-support. Safe to re-run: upsert, not create.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { authConfig } from '../src/config/auth.config';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(authConfig.demoPassword, 10);

  const user = await prisma.user.upsert({
    where: { username: authConfig.demoUsername },
    update: { passwordHash },
    create: {
      username: authConfig.demoUsername,
      passwordHash,
      role: 'ANALYST',
    },
  });

  console.log(`Seeded demo user: ${user.username} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
