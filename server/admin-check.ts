import type { Request } from "express";
import { storage } from "./storage";

export async function isAdminSession(req: Request): Promise<boolean> {
  const adminUserId = (req.session as Record<string, unknown>)?.userId as string | undefined;
  if (!adminUserId) return false;
  const user = await storage.getUserById(adminUserId);
  return !!(user?.isAdmin);
}
