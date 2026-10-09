// Type declarations for the JS detector module, so the TS guard test gets real types instead of
// implicit `any`.

export interface Violation {
  /** 1-based line number in the scanned source. */
  line: number;
  /** The offending text, quoted as it appears. */
  text: string;
  /** Which detector fired, in words. */
  why: string;
}

export const USER_FACING_PROPS: string[];
export const ALLOWED_LITERALS: Set<string>;

export function propViolations(src: string): Violation[];
export function argumentViolations(src: string): Violation[];
export function templateViolations(src: string): Violation[];
export function placeholderViolations(src: string): Violation[];
export function tupleLabelViolations(src: string): Violation[];
export function jsxTextViolations(src: string): Violation[];
export function proseViolations(src: string): Violation[];
export function scanSource(src: string): Violation[];

/** JSX text alone on its line, between its tags on the lines above and below. */
export function loneJsxTextViolations(src: string): Violation[];
