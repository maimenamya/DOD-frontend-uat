/** Trim trailing `/` without regex (Sonar S8786). */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47 /* / */) end -= 1;
  return value.slice(0, end);
}
