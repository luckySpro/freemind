// Type declarations for the JS book-chapter manifest, so the TS test (and any TS
// importer) gets real types instead of implicit `any`.

export const PROJECT_ROOT: string;
export const GUIDE_DIR: string;
export const PUBLIC_DIR: string;
export const BOOK_ID: string;
export const BOOK_TITLE: string;
export const BOOK_SUBTITLE: string;
export const BOOK_AUTHOR: string;
export const BOOK_LANG: string;
export const BOOK_PUBLISHER: string;
export const BOOK_SUBJECTS: string[];
export const BOOK_SLUG: string;
export const CHAPTER_FILES: string[];

export interface ChapterMeta {
  filename: string;
  slug: string;
  title: string;
  subtitle: string | null;
  raw: string;
}

export function readChapterMetadata(): Promise<ChapterMeta[]>;

export interface TocGroup {
  label: string;
  match: (c: ChapterMeta) => boolean;
}

export const TOC_GROUPS: TocGroup[];
