"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "../auth";
import { prisma } from "./prisma";
import { hashPassword } from "./password";

export type AuthState = { error?: string };

export async function createAccount(_: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return { error: "Enter your name, a valid email, and a password of at least 8 characters." };
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "An account already exists for this email." };
  }
  await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password), role: "CLIENT" } });
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  redirect("/dashboard");
}

export async function authenticate(_: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password." };
    throw error;
  }
  return {};
}
