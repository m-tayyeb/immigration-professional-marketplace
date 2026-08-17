"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { isCompleteClientContact } from "./assessment-intake";
import { prisma } from "./prisma";

export async function updateClientProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role !== "CLIENT") throw new Error("Only clients can update client contact details.");

  const contact = {
    name: String(formData.get("name") ?? "").trim(),
    email: session.user.email ?? "",
    profile: {
      telephone: String(formData.get("telephone") ?? "").trim(),
      addressLine: String(formData.get("addressLine") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      postalCode: String(formData.get("postalCode") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
    },
  };
  if (!isCompleteClientContact(contact)) throw new Error("Complete all contact details and use a telephone number with country code.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: { name: contact.name } }),
    prisma.clientProfile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...contact.profile },
      update: contact.profile,
    }),
  ]);
  revalidatePath("/profile");
  revalidatePath("/services");
  revalidatePath("/dashboard");
  redirect("/services");
}
