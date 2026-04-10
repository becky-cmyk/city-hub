const TEMPLATE_HEADER_PATTERNS = [
  /\*\*Headline Lead\*\*/gi,
  /\*\*Key Facts\*\*/gi,
  /\*\*Community FAQ\*\*/gi,
  /\*\*Source Credit\*\*/gi,
  /\*\*Full Story\*\*/gi,
  /\*\*Q:\s*[^*]*\*\*/g,
  /^A:\s(?=[A-Z])/gm,
  /SECTION\s*\d+\s*[—–-]\s*(HEADLINE LEAD|FULL STORY|KEY FACTS|COMMUNITY FAQ|SOURCE CREDIT)[^\n]*/gi,
];

export function sanitizeArticleBody(text: string): string {
  if (!text) return text;
  let result = text;
  for (const pattern of TEMPLATE_HEADER_PATTERNS) {
    result = result.replace(pattern, "");
  }
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  return result;
}
