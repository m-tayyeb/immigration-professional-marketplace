import { NextResponse } from "next/server";
import { ConsultationStatus, UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type RequestBody = {
  clientName?: string;
  email?: string;
  professionalId?: string;
  professionalName?: string;
  countryName?: string;
  serviceName?: string;
  preferredLanguage?: string;
  preferredDateTime?: string;
  description?: string;
};

const serviceNames: Record<string, string> = {
  "student visas": "Student Visa",
  "work visas": "Work Visa",
  "family reunification": "Family Reunification",
  "residence permits": "Residence Permit",
  "permanent residence": "Permanent Residence",
  citizenship: "Citizenship",
};

function requiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit a valid consultation request." }, { status: 400 });
  }

  const clientName = requiredString(body.clientName);
  const email = requiredString(body.email).toLowerCase();
  const professionalId = requiredString(body.professionalId);
  const professionalName = requiredString(body.professionalName);
  const countryName = requiredString(body.countryName);
  const selectedService = requiredString(body.serviceName);
  const preferredLanguage = requiredString(body.preferredLanguage);
  const description = requiredString(body.description);

  if (!clientName || !email || (!professionalId && !professionalName) || !countryName || !selectedService || !preferredLanguage || !description) {
    return NextResponse.json({ error: "Please complete all required fields before sending your request." }, { status: 400 });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  let preferredDateTime: Date | null = null;
  if (body.preferredDateTime) {
    preferredDateTime = new Date(body.preferredDateTime);
    if (Number.isNaN(preferredDateTime.getTime())) {
      return NextResponse.json({ error: "Please enter a valid preferred date and time." }, { status: 400 });
    }
  }

  const serviceName = serviceNames[selectedService.toLowerCase()] ?? selectedService;

  try {
    const [country, service] = await Promise.all([
      prisma.country.findUnique({ where: { name: countryName }, select: { id: true } }),
      prisma.immigrationService.findUnique({ where: { name: serviceName }, select: { id: true } }),
    ]);

    if (!country || !service) {
      return NextResponse.json({ error: "This consultation option is not available yet. Please try another selection." }, { status: 400 });
    }

    const professional = await prisma.professionalProfile.findFirst({
      where: {
        ...(professionalId ? { id: professionalId } : { user: { name: professionalName } }),
        countries: { some: { countryId: country.id } },
        services: { some: { serviceId: service.id } },
      },
      select: { id: true },
    });

    if (!professional) {
      return NextResponse.json({ error: "This consultation option is not available yet. Please try another selection." }, { status: 400 });
    }

    const client = await prisma.user.upsert({
      where: { email },
      update: { name: clientName },
      create: { email, name: clientName, role: UserRole.CLIENT },
      select: { id: true },
    });

    const consultationRequest = await prisma.consultationRequest.create({
      data: {
        clientId: client.id,
        professionalId: professional.id,
        countryId: country.id,
        serviceId: service.id,
        description,
        preferredLanguage,
        preferredDateTime,
        status: ConsultationStatus.PENDING,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: consultationRequest.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to create consultation request", error);
    return NextResponse.json({ error: "We could not save your request. Please try again." }, { status: 500 });
  }
}
