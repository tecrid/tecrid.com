/** Presentation punctuation must not rewrite canonical record data or fingerprints. */
export function publicCopy(value: string) {
  return value.replace(/\s*[\u2014\u2013]\s*/g, ", ");
}
