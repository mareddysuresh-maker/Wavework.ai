import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = bcrypt.hashSync('password123', 10);
  await prisma.user.upsert({
    where: { email: 'client@flowup.io' },
    update: {},
    create: {
      id: 'u-client',
      name: 'Client Demo',
      email: 'client@flowup.io',
      password: hash,
      avatarUrl: 'C',
      color: 'bg-emerald-500 text-white',
      role: 'SUPER_ADMIN',
      workspaceId: 'w-1',
      activeWorkspaceId: 'w-1'
    }
  });

  // Create WorkspaceMembership for the client
  try {
    await prisma.workspaceMembership.upsert({
      where: {
        userId_workspaceId: {
          userId: 'u-client',
          workspaceId: 'w-1'
        }
      },
      update: {},
      create: {
        id: 'wm-u-client-w-1',
        userId: 'u-client',
        workspaceId: 'w-1',
        role: 'SUPER_ADMIN',
        createdAt: new Date()
      }
    });
  } catch (e) {
    console.log(e);
  }

  console.log('Client demo user inserted successfully.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
