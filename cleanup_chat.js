import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting chat data cleanup...");
  
  // 1. Delete all messages
  const messageDelete = await prisma.message.deleteMany({});
  console.log(`Deleted ${messageDelete.count} messages.`);

  // 2. Delete all channels/DMs
  const channelDelete = await prisma.channel.deleteMany({});
  console.log(`Deleted ${channelDelete.count} channels/DMs.`);

  // 3. Delete all chat requests
  const chatRequestDelete = await prisma.chatRequest.deleteMany({});
  console.log(`Deleted ${chatRequestDelete.count} chat requests.`);

  console.log("Chat data cleanup complete!");
}

main()
  .catch(e => {
    console.error("Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
