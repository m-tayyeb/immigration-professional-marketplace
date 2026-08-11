import { ProfessionalResults } from "../../components/professional-results";
import { getProfessionals } from "../../lib/professional-data";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const professionals = await getProfessionals();
  return <ProfessionalResults professionals={professionals} />;
}
