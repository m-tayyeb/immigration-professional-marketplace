import { PrismaClient, ProfessionalType, UserRole, VerificationStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database. Copy .env.example to .env and provide a PostgreSQL URL.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const countries = await Promise.all([
    ["Finland", "FI"], ["Canada", "CA"], ["United Kingdom", "GB"], ["Germany", "DE"], ["Australia", "AU"], ["Sweden", "SE"],
  ].map(([name, code]) => prisma.country.upsert({ where: { code }, update: {}, create: { name, code } })));

  const services = await Promise.all([
    ["Student Visa", "Support for study-based immigration applications."], ["Work Visa", "Guidance for employment-based immigration routes."], ["Family Reunification", "Support for family residence applications."], ["Residence Permit", "Advice for temporary and long-term residence permits."], ["Permanent Residence", "Planning and support for permanent residence routes."], ["Citizenship", "Naturalisation and citizenship application guidance."], ["Business Immigration", "Immigration support for founders and entrepreneurs."],
  ].map(([name, description]) => prisma.immigrationService.upsert({ where: { name }, update: {}, create: { name, description } })));

  const annaUser = await prisma.user.upsert({ where: { email: "anna.laine@example.test" }, update: {}, create: { email: "anna.laine@example.test", name: "Anna Laine", role: UserRole.PROFESSIONAL } });
  const mikaelUser = await prisma.user.upsert({ where: { email: "mikael.soder@example.test" }, update: {}, create: { email: "mikael.soder@example.test", name: "Mikael Soder", role: UserRole.PROFESSIONAL } });
  await prisma.user.upsert({ where: { email: "client@example.test" }, update: {}, create: { email: "client@example.test", name: "Sample Client", role: UserRole.CLIENT } });

  const anna = await prisma.professionalProfile.upsert({ where: { userId: annaUser.id }, update: {}, create: { userId: annaUser.id, professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Immigration lawyer supporting professionals and families relocating to Finland.", location: "Helsinki, Finland", yearsOfExperience: 14, verificationStatus: VerificationStatus.VERIFIED, rating: 4.9, reviewCount: 86, completedCases: 618 } });
  const mikael = await prisma.professionalProfile.upsert({ where: { userId: mikaelUser.id }, update: {}, create: { userId: mikaelUser.id, professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Immigration adviser focused on student, work, and family applications for Finland.", location: "Tampere, Finland", yearsOfExperience: 9, verificationStatus: VerificationStatus.VERIFIED, rating: 4.8, reviewCount: 54, completedCases: 396 } });
  const finland = countries.find((country) => country.code === "FI")!;
  const workVisa = services.find((service) => service.name === "Work Visa")!;
  const studentVisa = services.find((service) => service.name === "Student Visa")!;

  await prisma.professionalCountry.createMany({ data: [{ professionalId: anna.id, countryId: finland.id }, { professionalId: mikael.id, countryId: finland.id }], skipDuplicates: true });
  await prisma.professionalLanguage.createMany({ data: [{ professionalId: anna.id, language: "English" }, { professionalId: anna.id, language: "Finnish" }, { professionalId: mikael.id, language: "English" }, { professionalId: mikael.id, language: "Finnish" }, { professionalId: mikael.id, language: "Swedish" }], skipDuplicates: true });
  await prisma.professionalService.upsert({ where: { professionalId_serviceId: { professionalId: anna.id, serviceId: workVisa.id } }, update: {}, create: { professionalId: anna.id, serviceId: workVisa.id, price: 180, durationMinutes: 45, description: "Initial work visa strategy consultation." } });
  await prisma.professionalService.upsert({ where: { professionalId_serviceId: { professionalId: mikael.id, serviceId: studentVisa.id } }, update: {}, create: { professionalId: mikael.id, serviceId: studentVisa.id, price: 110, durationMinutes: 30, description: "Student visa eligibility and application consultation." } });
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
