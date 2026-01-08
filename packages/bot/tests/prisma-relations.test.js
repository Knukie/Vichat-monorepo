import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/valki_test";

const prisma = new PrismaClient();

try {
  await prisma.message.findFirst({ include: { sender: true } });
} finally {
  await prisma.$disconnect();
}
