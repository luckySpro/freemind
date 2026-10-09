import { t } from "../../../i18n/registry";
import "../messages";
import { useRef, useState } from "react";
import type { StartContext } from "../types";

// Drag-and-drop drop zone + the real supported-format grid (matches App's file <input> accept).
// Hands files to App's import pipeline via ctx.onImportFiles.

const ACCEPT =
  ".mmap,.mmp,.md,.markdown,.json,.opml,.mm,.mmd,.mermaid,.xmind,.smmx,.docx,.xlsx,.itmz,.mind,.mup,.textpack,.textbundle";

const FORMATS: { ext: string; name: string }[] = [
  { ext: ".mmap", name: "MindManager" },
  { ext: ".md", name: "Markdown / Markmap" },
  { ext: ".opml", name: "OPML outline" },
  { ext: ".mm", name: "FreeMind / Freeplane" },
  { ext: ".mmd", name: "Mermaid" },
  { ext: ".xmind", name: "XMind" },
  { ext: ".smmx", name: "SimpleMind" },
  { ext: ".itmz", name: "iThoughts" },
  { ext: ".mind", name: "MindMeister" },
  { ext: ".mup", name: "MindMup" },
  { ext: ".textpack", name: "TextBundle" },
  { ext: ".docx", name: "Word outline" },
  { ext: ".xlsx", name: "Excel outline" },
  { ext: ".json", name: "Native (.json)" },
];

export function ImportView({ ctx }: { ctx: StartContext }) {
  const [over, setOver] = useState(false);
  // dragenter/dragleave also fire as the cursor crosses the drop zone's own children (the icon/text),
  // so a naive boolean flickers off mid-drag. Count enter vs leave and stay highlighted while the
  // depth is positive — the highlight only clears once the drag has truly left the whole zone.
  const dragDepth = useRef(0);

  const browse = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) ctx.onImportFiles([...input.files]);
    };
    input.click();
  };

  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("start.import")}</h2>
        <p className="st-section-sub">{t("start.importBlurb")}</p>
      </section>

      <button
        type="button"
        className="st-card"
        style={{
          padding: 36,
          textAlign: "center",
          borderStyle: "dashed",
          borderColor: over ? "var(--st-accent)" : undefined,
          background: over ? "var(--st-accent-tint)" : undefined,
          cursor: "pointer",
          width: "100%",
        }}
        onClick={browse}
        onDragEnter={() => {
          dragDepth.current += 1;
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()} // required so the drop is allowed
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setOver(false);
          const files = [...e.dataTransfer.files];
          if (files.length) ctx.onImportFiles(files);
        }}
      >
        <div style={{ fontSize: 28 }} aria-hidden="true">
          ⤓
        </div>
        <div style={{ fontWeight: 600, marginTop: 6 }}>{t("start.dropAFileHereOr")}</div>
        <div className="st-card-meta" style={{ justifyContent: "center", marginTop: 4 }}>
          {t("start.oneFileOpensAsA")}
        </div>
      </button>

      <section>
        <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
          {t("start.supportedFormats")}
        </h3>
        <div className="st-grid" style={{ marginTop: 10 }}>
          {FORMATS.map((f) => (
            <div key={f.ext} className="st-card" style={{ padding: "12px 14px" }}>
              <div
                className="start-mono"
                style={{ color: "var(--st-accent)", fontSize: 12, fontWeight: 600 }}
              >
                {f.ext}
              </div>
              <div className="st-card-meta">{f.name}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
