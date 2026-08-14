import { PrismaClient, ProfessionalType, UserRole, VerificationStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database. Copy .env.example to .env and provide a PostgreSQL URL.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const serviceNames: Record<string, string> = {
  "Student visas": "Student Visa",
  "Work visas": "Work Visa",
  "Family reunification": "Family Reunification",
  "Residence permits": "Residence Permit",
  "Permanent residence": "Permanent Residence",
  Citizenship: "Citizenship",
};

type SeedService = { uiName: keyof typeof serviceNames; price: number; durationMinutes: number; description: string };
type SeedProfessional = {
  email: string;
  name: string;
  professionalType: ProfessionalType;
  bio: string;
  location: string;
  yearsOfExperience: number;
  rating: number;
  reviewCount: number;
  completedCases: number;
  countryCodes: string[];
  languages: string[];
  services: SeedService[];
};

function offeredServices(names: (keyof typeof serviceNames)[], price: number, durationMinutes: number): SeedService[] {
  return names.map((uiName) => ({
    uiName,
    price,
    durationMinutes,
    description: `Guidance on eligibility, preparation, and the application process for ${uiName.toLowerCase()}.`,
  }));
}

// This catalog mirrors the current UI professional collection and is the seed source of truth.
const professionals: SeedProfessional[] = [
  { email: "anna.laine@example.test", name: "Anna Laine", professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Practical, clear support for professionals and families building their lives in Finland.", location: "Finland", yearsOfExperience: 14, rating: 4.9, reviewCount: 86, completedCases: 618, countryCodes: ["FI"], languages: ["English", "Finnish", "Swedish"], services: offeredServices(["Work visas", "Residence permits", "Citizenship"], 180, 45) },
  { email: "mikael.soder@example.test", name: "Mikael Söder", professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Focused guidance for students, researchers, and growing international families.", location: "Finland", yearsOfExperience: 9, rating: 4.8, reviewCount: 54, completedCases: 396, countryCodes: ["FI"], languages: ["English", "Finnish", "Swedish", "Russian"], services: offeredServices(["Student visas", "Work visas", "Family reunification"], 110, 30) },
  { email: "claire.mitchell@example.test", name: "Claire Mitchell", professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Canadian immigration counsel for skilled workers, employers, and permanent residence applicants.", location: "Ontario, Canada", yearsOfExperience: 16, rating: 4.9, reviewCount: 122, completedCases: 730, countryCodes: ["CA"], languages: ["English", "French"], services: offeredServices(["Permanent residence", "Work visas", "Citizenship"], 220, 60) },
  { email: "dev.patel@example.test", name: "Dev Patel", professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Thoughtful, step-by-step help with Canadian study and family immigration pathways.", location: "Canada", yearsOfExperience: 8, rating: 4.7, reviewCount: 76, completedCases: 380, countryCodes: ["CA"], languages: ["English", "Hindi", "Punjabi"], services: offeredServices(["Student visas", "Permanent residence", "Family reunification"], 125, 45) },
  { email: "eleanor.price@example.test", name: "Eleanor Price", professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Experienced adviser on UK work routes, settlement, and complex family applications.", location: "England & Wales", yearsOfExperience: 18, rating: 4.9, reviewCount: 109, completedCases: 793, countryCodes: ["GB"], languages: ["English", "Spanish"], services: offeredServices(["Work visas", "Family reunification", "Citizenship"], 240, 60) },
  { email: "omar.hassan@example.test", name: "Omar Hassan", professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Accessible UK visa support with particular experience in graduate and skilled worker routes.", location: "United Kingdom", yearsOfExperience: 7, rating: 4.6, reviewCount: 43, completedCases: 309, countryCodes: ["GB"], languages: ["English", "Arabic", "French"], services: offeredServices(["Student visas", "Work visas", "Residence permits"], 105, 30) },
  { email: "johanna.weber@example.test", name: "Johanna Weber", professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Berlin-based legal guidance for employees, entrepreneurs, and long-term residents.", location: "Germany", yearsOfExperience: 13, rating: 4.8, reviewCount: 68, completedCases: 562, countryCodes: ["DE"], languages: ["German", "English", "Polish"], services: offeredServices(["Work visas", "Residence permits", "Citizenship"], 190, 45) },
  { email: "leon.fischer@example.test", name: "Leon Fischer", professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Friendly, reliable application support for newcomers navigating German bureaucracy.", location: "Germany", yearsOfExperience: 6, rating: 4.7, reviewCount: 39, completedCases: 267, countryCodes: ["DE"], languages: ["German", "English", "Turkish"], services: offeredServices(["Student visas", "Work visas", "Family reunification"], 95, 30) },
  { email: "sophie.campbell@example.test", name: "Sophie Campbell", professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Strategic Australian migration advice for skilled professionals and their families.", location: "New South Wales, Australia", yearsOfExperience: 15, rating: 4.9, reviewCount: 93, completedCases: 663, countryCodes: ["AU"], languages: ["English", "Mandarin"], services: offeredServices(["Work visas", "Permanent residence", "Citizenship"], 230, 60) },
  { email: "liam.nguyen@example.test", name: "Liam Nguyen", professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Clear and supportive migration planning for students and skilled visa applicants.", location: "Australia", yearsOfExperience: 10, rating: 4.8, reviewCount: 76, completedCases: 456, countryCodes: ["AU"], languages: ["English", "Vietnamese", "Mandarin"], services: offeredServices(["Student visas", "Work visas", "Permanent residence"], 140, 45) },
  { email: "elin.lindberg@example.test", name: "Elin Lindberg", professionalType: ProfessionalType.IMMIGRATION_LAWYER, bio: "Personal, meticulous support for Swedish work permits and family residence cases.", location: "Sweden", yearsOfExperience: 12, rating: 4.8, reviewCount: 64, completedCases: 520, countryCodes: ["SE"], languages: ["Swedish", "English", "French"], services: offeredServices(["Work visas", "Family reunification", "Residence permits"], 175, 45) },
  { email: "gustav.nordin@example.test", name: "Gustav Nordin", professionalType: ProfessionalType.ACCREDITED_ADVISER, bio: "Straightforward relocation support for international students and professionals.", location: "Sweden", yearsOfExperience: 7, rating: 4.6, reviewCount: 41, completedCases: 307, countryCodes: ["SE"], languages: ["Swedish", "English", "Arabic"], services: offeredServices(["Student visas", "Work visas", "Citizenship"], 100, 30) },
];

async function main() {
  const countries = await Promise.all([
    ["Finland", "FI"], ["Canada", "CA"], ["United Kingdom", "GB"], ["Germany", "DE"], ["Australia", "AU"], ["Sweden", "SE"],
  ].map(([name, code]) => prisma.country.upsert({ where: { code }, update: { name }, create: { name, code } })));

  const services = await Promise.all([
    ["Student Visa", "Support for study-based immigration applications."], ["Work Visa", "Guidance for employment-based immigration routes."], ["Family Reunification", "Support for family residence applications."], ["Residence Permit", "Advice for temporary and long-term residence permits."], ["Permanent Residence", "Planning and support for permanent residence routes."], ["Citizenship", "Naturalisation and citizenship application guidance."], ["Business Immigration", "Immigration support for founders and entrepreneurs."],
  ].map(([name, description]) => prisma.immigrationService.upsert({ where: { name }, update: { description }, create: { name, description } })));

  await Promise.all([
    { code: "FIRST_RESIDENCE_PERMIT", name: "First Residence Permit", description: "Assessment and end-to-end support for a first Finnish residence permit.", totalPrice: 500 },
    { code: "RESIDENCE_PERMIT_RENEWAL", name: "Residence Permit Renewal", description: "Assessment and end-to-end support for renewing a Finnish residence permit.", totalPrice: 500 },
    { code: "OTHER", name: "Other", description: "Assessment for immigration, integration, licensing, or social-benefit guidance.", totalPrice: null },
  ].map((service) => prisma.immigrationService.upsert({
    where: { code: service.code },
    update: { ...service, assessmentFee: 100, active: true },
    create: { ...service, assessmentFee: 100, active: true },
  })));

  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const serviceByName = new Map(services.map((service) => [service.name, service]));

  for (const seedProfessional of professionals) {
    const passwordHash = await hashPassword("Professional123!");
    const user = await prisma.user.upsert({
      where: { email: seedProfessional.email },
      update: { name: seedProfessional.name, role: UserRole.PROFESSIONAL },
      create: { email: seedProfessional.email, name: seedProfessional.name, role: UserRole.PROFESSIONAL, passwordHash },
    });

    const profile = await prisma.professionalProfile.upsert({
      where: { userId: user.id },
      update: {
        professionalType: seedProfessional.professionalType,
        bio: seedProfessional.bio,
        location: seedProfessional.location,
        yearsOfExperience: seedProfessional.yearsOfExperience,
        verificationStatus: VerificationStatus.VERIFIED,
        rating: seedProfessional.rating,
        reviewCount: seedProfessional.reviewCount,
        completedCases: seedProfessional.completedCases,
      },
      create: {
        userId: user.id,
        professionalType: seedProfessional.professionalType,
        bio: seedProfessional.bio,
        location: seedProfessional.location,
        yearsOfExperience: seedProfessional.yearsOfExperience,
        verificationStatus: VerificationStatus.VERIFIED,
        rating: seedProfessional.rating,
        reviewCount: seedProfessional.reviewCount,
        completedCases: seedProfessional.completedCases,
      },
    });

    const countryIds = seedProfessional.countryCodes.map((code) => {
      const country = countryByCode.get(code);
      if (!country) throw new Error(`Missing country seed for ${code}.`);
      return country.id;
    });
    await prisma.professionalCountry.createMany({ data: countryIds.map((countryId) => ({ professionalId: profile.id, countryId })), skipDuplicates: true });
    await prisma.professionalLanguage.createMany({ data: seedProfessional.languages.map((language) => ({ professionalId: profile.id, language })), skipDuplicates: true });

    for (const seedService of seedProfessional.services) {
      const service = serviceByName.get(serviceNames[seedService.uiName]);
      if (!service) throw new Error(`Missing service seed for ${seedService.uiName}.`);
      await prisma.professionalService.upsert({
        where: { professionalId_serviceId: { professionalId: profile.id, serviceId: service.id } },
        update: { price: seedService.price, durationMinutes: seedService.durationMinutes, description: seedService.description },
        create: { professionalId: profile.id, serviceId: service.id, price: seedService.price, durationMinutes: seedService.durationMinutes, description: seedService.description },
      });
    }
  }

  await prisma.user.upsert({
    where: { email: "client@example.test" },
    update: {},
    create: { email: "client@example.test", name: "Demo Client", role: UserRole.CLIENT, passwordHash: await hashPassword("Client123!") },
  });
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
