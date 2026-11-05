const JOB_APPLICATION_CONTEXT_PATTERN = /vaga|vagas|candidatura|candidatar|trabalhe.?conosco|career|careers|job|jobs|apply|application|recruitment|recrutamento/i;

export function isLikelyJobApplicationPage(context: string): boolean {
  return JOB_APPLICATION_CONTEXT_PATTERN.test(context);
}
