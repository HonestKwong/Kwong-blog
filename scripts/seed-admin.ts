import { prisma } from "@/core/db/client";
import { hashPassword } from "@/core/auth/password";

export async function seedAdmin(input: {
  email: string;
  password: string;
}): Promise<void> {
  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (!existing) {
    await prisma.user.create({
      data: { email: input.email, passwordHash },
    });
    return;
  }
  await prisma.user.update({
    where: { email: input.email },
    data: { passwordHash },
  });
}
