import { prisma } from "@/core/db/client";
import { seedAdmin } from "./seed-admin";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }
  await seedAdmin({ email, password });
  console.log(`Admin ready: ${email}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
