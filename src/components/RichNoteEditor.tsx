import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { readNoteImage } from "../io/noteImage";
import { sanitizeNotePaste } from "./notePaste";

export default function RichNoteEditor({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const callbacks = useRef({ onChange, onBlur });
  callbacks.current = { onChange, onBlur };
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      ImageExtension.configure({ allowBase64: true }),
      TableKit,
      Highlight,
      Markdown,
    ],
    content: value,
    contentType: "markdown",
    onUpdate: ({ editor: current }) => callbacks.current.onChange(current.getMarkdown()),
    onBlur: () => callbacks.current.onBlur(),
    editorProps: {
      attributes: {
        class: "mm-note-editor freemind-writing",
        "aria-label": "图文备注",
        role: "textbox",
        "aria-multiline": "true",
      },
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const files = Array.from(clipboard.files).filter((file) => file.type.startsWith("image/"));
        const html = clipboard.getData("text/html");
        if (files.length) {
          event.preventDefault();
          const originalDoc = view.state.doc;
          const selection = view.state.selection;
          void Promise.all(files.map(readNoteImage))
            .then((images) => {
              if (view.isDestroyed) return;
              if (!view.state.doc.eq(originalDoc)) {
                setError("图片读取期间正文已改变，请重新粘贴。");
                return;
              }
              const content = html
                ? sanitizeNotePaste(html, images)
                : images.map((src) => `<img src="${src}" />`).join("");
              editor
                ?.chain()
                .focus()
                .insertContentAt({ from: selection.from, to: selection.to }, content)
                .run();
              setError("");
            })
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : "图片粘贴失败。"),
            );
          return true;
        }
        if (html) {
          event.preventDefault();
          editor?.commands.insertContent(sanitizeNotePaste(html));
          return true;
        }
        return false;
      },
    },
  });
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getMarkdown() !== value) {
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;
  const action = (label: string, run: () => void) => (
    <button type="button" key={label} onMouseDown={(event) => event.preventDefault()} onClick={run}>
      {label}
    </button>
  );
  return (
    <div className="freemind-writer">
      <div className="freemind-writing-toolbar" role="toolbar" aria-label="图文格式">
        {action("粗体", () => {
          editor.chain().focus().toggleBold().run();
        })}
        {action("斜体", () => {
          editor.chain().focus().toggleItalic().run();
        })}
        {action("高亮", () => {
          editor.chain().focus().toggleHighlight().run();
        })}
        {action("小标题", () => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        })}
        {action("列表", () => {
          editor.chain().focus().toggleBulletList().run();
        })}
        {action("编号", () => {
          editor.chain().focus().toggleOrderedList().run();
        })}
        {action("代码", () => {
          editor.chain().focus().toggleCodeBlock().run();
        })}
        {action("表格", () => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        })}
        {action("图片", () => fileInput.current?.click())}
        {action("撤销", () => {
          editor.chain().focus().undo().run();
        })}
        {action("重做", () => {
          editor.chain().focus().redo().run();
        })}
      </div>
      <p className="freemind-writing-hint">
        可直接粘贴截图、图文和表格。图片随导图保存，Word 导出包含正文。
      </p>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const originalDoc = editor.state.doc;
          const selection = editor.state.selection;
          try {
            const src = await readNoteImage(file);
            if (editor.isDestroyed) return;
            if (!editor.state.doc.eq(originalDoc))
              throw new Error("图片读取期间正文已改变，请重新插入。");
            editor
              .chain()
              .focus()
              .insertContentAt(
                { from: selection.from, to: selection.to },
                { type: "image", attrs: { src, alt: file.name } },
              )
              .run();
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "图片插入失败。");
          }
        }}
      />
      {error && <div role="alert">{error}</div>}
      <EditorContent editor={editor} />
    </div>
  );
}
