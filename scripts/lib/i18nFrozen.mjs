// Find FROZEN module-level `t()` calls — the ones evaluated once at import, whose string can never
// follow a later `setLocale`. See test/i18n-frozen-constants.test.ts, which proves the mechanism in
// both directions, and docs/I18N_BLOCKED.md item 4 for the investigation + resolution history (the
// BUDGET in test/i18n-frozen-ratchet.test.ts is empty now — this still runs so a regression is caught).
//
// Precision matters here: a regex cannot tell `{ label: t("x") }` at module scope from the same text
// inside a component's JSX, and the difference is exactly what makes one frozen and the other live. So
// this walks the real TypeScript AST and asks a single question per call — does any ancestor defer
// evaluation? A function, arrow, method, accessor or class body does; an object or array literal does
// not. Everything else is bookkeeping.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const DEFERS_EVALUATION = [
  ts.isFunctionDeclaration,
  ts.isFunctionExpression,
  ts.isArrowFunction,
  ts.isMethodDeclaration,
  ts.isGetAccessor,
  ts.isSetAccessor,
  ts.isConstructorDeclaration,
  ts.isClassDeclaration,
];

const defersEvaluation = (node) => DEFERS_EVALUATION.some((is) => is(node));

/** Every module-scope `t(...)` call under `root`, as `{ file, line, text }`, sorted by file. */
export function findFrozenCalls(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(path);
    }
  };
  walk(root);

  const hits = [];
  for (const file of files.sort()) {
    const source = readFileSync(file, "utf8");
    // Cheap pre-filter — parsing every file costs far more than this string test.
    if (!/\bt\(/.test(source)) continue;
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    );

    const visit = (node, deferred) => {
      const nowDeferred = deferred || defersEvaluation(node);
      if (
        !nowDeferred &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t"
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        hits.push({ file, line: line + 1, text: node.getText() });
      }
      ts.forEachChild(node, (child) => visit(child, nowDeferred));
    };
    ts.forEachChild(sourceFile, (child) => visit(child, false));
  }
  return hits;
}

/** `findFrozenCalls` collapsed to `file -> count`, for the ratchet's per-file budget. */
export function frozenByFile(root) {
  const counts = new Map();
  for (const hit of findFrozenCalls(root)) counts.set(hit.file, (counts.get(hit.file) ?? 0) + 1);
  return counts;
}
