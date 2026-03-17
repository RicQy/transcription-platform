import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = 'admin@transcribe.local';
  const transcriptionistEmail = 'transcriptionist@transcribe.local';
  const defaultPassword = 'password123';

  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: transcriptionistEmail },
    update: {},
    create: {
      email: transcriptionistEmail,
      passwordHash,
      role: Role.TRANSCRIPTIONIST,
    },
  });

  console.log('Seed complete');
  console.log(`Admin: ${adminEmail} / ${defaultPassword}`);
  console.log(`Transcriptionist: ${transcriptionistEmail} / ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
