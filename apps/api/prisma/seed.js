const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@transcribe.local' },
    update: {},
    create: { email: 'admin@transcribe.local', passwordHash: hash, role: 'ADMIN' }
  });
  await prisma.user.upsert({
    where: { email: 'transcriptionist@transcribe.local' },
    update: {},
    create: { email: 'transcriptionist@transcribe.local', passwordHash: hash, role: 'TRANSCRIPTIONIST' }
  });
  console.log('Seed complete');
  console.log('Admin: admin@transcribe.local / password123');
  console.log('Transcriptionist: transcriptionist@transcribe.local / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
