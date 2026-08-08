import { prisma } from "@/core/db/client";
import { verifyPassword } from "./password";

export async function authenticate(
  email: string,
  password: string,
): Promise<{ userId: string } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? { userId: user.id } : null;
}
