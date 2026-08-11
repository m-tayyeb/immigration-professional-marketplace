import { prisma } from "./prisma";

export type ProfessionalService = { name: string; price: number; duration: string; description: string };
export type ProfessionalReview = { client: string; rating: number; text: string; date: string };
export type Professional = {
  id: string;
  profileId: string;
  name: string;
  type: "Immigration Lawyer" | "Accredited Immigration Advisor";
  country: string;
  practiceCountries: string[];
  jurisdiction: string;
  experience: number;
  specializations: string[];
  languages: string[];
  rating: number;
  reviews: number;
  price: number;
  description: string;
  completedCases: number;
  qualifications: string[];
  services: ProfessionalService[];
  clientReviews: ProfessionalReview[];
};

const displayServiceNames: Record<string, string> = {
  "Student Visa": "Student visas",
  "Work Visa": "Work visas",
  "Family Reunification": "Family reunification",
  "Residence Permit": "Residence permits",
  "Permanent Residence": "Permanent residence",
  Citizenship: "Citizenship",
};

export function slugifyProfessionalName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function displayProfessionalType(type: "IMMIGRATION_LAWYER" | "ACCREDITED_ADVISER") {
  return type === "IMMIGRATION_LAWYER" ? "Immigration Lawyer" : "Accredited Immigration Advisor";
}

const professionalInclude = {
  user: { select: { name: true } },
  countries: { include: { country: true } },
  languages: true,
  services: { include: { service: true } },
  credentials: true,
  reviews: { include: { client: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } },
};

async function getProfileRecords() {
  return prisma.professionalProfile.findMany({ include: professionalInclude });
}

type PrismaProfessional = Awaited<ReturnType<typeof getProfileRecords>>[number];

function toProfessional(profile: PrismaProfessional): Professional {
  const services = profile.services.map((professionalService) => ({
    name: displayServiceNames[professionalService.service.name] ?? professionalService.service.name,
    price: Number(professionalService.price),
    duration: `${professionalService.durationMinutes}-minute consultation`,
    description: professionalService.description,
  }));
  const countries = profile.countries.map(({ country }) => country.name);

  return {
    id: slugifyProfessionalName(profile.user.name),
    profileId: profile.id,
    name: profile.user.name,
    type: displayProfessionalType(profile.professionalType),
    country: countries[0] ?? "",
    practiceCountries: countries,
    jurisdiction: profile.location,
    experience: profile.yearsOfExperience,
    specializations: services.map(({ name }) => name),
    languages: profile.languages.map(({ language }) => language),
    rating: Number(profile.rating),
    reviews: profile.reviewCount,
    price: Math.min(...services.map(({ price }) => price)),
    description: profile.bio,
    completedCases: profile.completedCases,
    qualifications: profile.credentials.map(({ credentialType, issuingAuthority }) => `${credentialType}, ${issuingAuthority}`),
    services,
    clientReviews: profile.reviews.map((review) => ({
      client: review.client.name,
      rating: review.rating,
      text: review.comment,
      date: review.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    })),
  };
}

export async function getProfessionals() {
  const profiles = await getProfileRecords();
  return profiles.map(toProfessional);
}

export async function getProfessionalBySlug(slug: string) {
  const professionals = await getProfessionals();
  return professionals.find((professional) => professional.id === slug);
}
