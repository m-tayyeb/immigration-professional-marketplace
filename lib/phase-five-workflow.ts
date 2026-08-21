export function canRecordMainSubmission(input: { remainingPaid: boolean; fileReady: boolean; finalReviewExists: boolean; alreadySubmitted: boolean; professional: boolean }) {
  return input.professional && input.remainingPaid && input.fileReady && input.finalReviewExists && !input.alreadySubmitted;
}

export function canAddSupplement(input: { mainSubmitted: boolean; decisionExists: boolean }) {
  return input.mainSubmitted && !input.decisionExists;
}

export function canSubmitSupplementaryResponse(input: { professional: boolean; decisionExists: boolean; alreadySubmitted: boolean; requirements: readonly { active: boolean; status: string }[] }) {
  const active = input.requirements.filter((requirement) => requirement.active);
  return input.professional && !input.decisionExists && !input.alreadySubmitted && active.length > 0 && active.every((requirement) => requirement.status === "ACCEPTED");
}

export function canRecordMigriDecision(input: { professional: boolean; mainSubmitted: boolean; decisionExists: boolean }) {
  return input.professional && input.mainSubmitted && !input.decisionExists;
}

export function canCompleteCase(input: { professional: boolean; decisionExists: boolean; completed: boolean }) {
  return input.professional && input.decisionExists && !input.completed;
}
