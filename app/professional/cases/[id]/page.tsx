import { AppHeader } from "../../../../components/app-header";
import { CaseDetail } from "../../../../components/case-detail";

export default async function ProfessionalCasePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <main className="min-h-screen bg-mist"><AppHeader role="PROFESSIONAL"/><CaseDetail caseId={id} professionalView/></main>; }
