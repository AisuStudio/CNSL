"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { copyText, downloadFile } from "@/lib/export";
import { htmlToRtf } from "@/lib/rtf";

// Formatting toolbar for the NotePad editor (Phase A).
// - Inline marks: B / I / U / S + Link
// - "aA" button opens a type-style menu (Title…Monospaced)
// - text alignment (left / center / right)
// Hover state = lime, active state = bright beige (driven by CSS classes in
// globals.css: .cnsl-tb-btn / .is-active, .cnsl-tstyle / .is-active).

// Caption + Monospaced are editor-only (no native markdown round-trip): Caption
// is a class-tagged paragraph (lost on reload), Monospaced maps to the inline
// `code` mark (round-trips as `…`). See plan Phase A.

type StyleItem = {
  label: string;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
  className?: string; // preview styling for the menu row
};

const TYPE_STYLES: StyleItem[] = [
  {
    label: "Title",
    className: "ts-title",
    isActive: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading",
    className: "ts-heading",
    isActive: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Subheading",
    className: "ts-subheading",
    isActive: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Paragraph",
    className: "ts-paragraph",
    isActive: (e) =>
      e.isActive("paragraph") &&
      e.getAttributes("paragraph").class !== "cnsl-caption" &&
      !e.isActive("bulletList") &&
      !e.isActive("orderedList"),
    run: (e) =>
      e
        .chain()
        .focus()
        .setParagraph()
        .updateAttributes("paragraph", { class: null })
        .run(),
  },
  {
    label: "Bulleted List",
    className: "ts-bulleted",
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered List",
    className: "ts-numbered",
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Caption",
    className: "ts-caption",
    // editor-only: toggle a class on the current paragraph node
    isActive: (e) => e.getAttributes("paragraph").class === "cnsl-caption",
    run: (e) => {
      const isCap = e.getAttributes("paragraph").class === "cnsl-caption";
      e.chain()
        .focus()
        .setParagraph()
        .updateAttributes("paragraph", { class: isCap ? null : "cnsl-caption" })
        .run();
    },
  },
  {
    label: "Monospaced",
    className: "ts-mono",
    isActive: (e) => e.isActive("code"),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
];

export default function NoteToolbar({
  editor,
  title,
}: {
  editor: Editor | null;
  title?: string;
}) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [, force] = useState(0);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Re-render on selection/transaction so active states stay in sync.
  useEffect(() => {
    if (!editor) return;
    const update = () => force((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  // Close the type menu on outside click.
  useEffect(() => {
    if (!styleOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setStyleOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [styleOpen]);

  if (!editor) return null;

  const setLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const prev = (editor.getAttributes("link").href as string) || "";
    const url = window.prompt("Link URL", prev);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // ── Exports (Copy MD · Save MD · Save RTF) ──
  const getMarkdown = () => editor.storage.markdown.getMarkdown() as string;
  const baseName = () =>
    (title || "").trim().replace(/[^a-z0-9\-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) ||
    "note";
  const copyMD = () => {
    copyText(getMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  // "Save MD" hidden per user — restore this with its button to re-enable.
  // const saveMD = () => downloadFile(`${baseName()}.md`, getMarkdown(), "text/markdown");
  const saveRTF = () =>
    downloadFile(`${baseName()}.rtf`, htmlToRtf(editor.getHTML()), "application/rtf");

  const activeStyle = TYPE_STYLES.find((s) => s.isActive(editor));

  return (
    <div className="cnsl-toolbar">
      {/* aA — type-style menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          type="button"
          className={`cnsl-tb-btn cnsl-tb-aa${styleOpen ? " is-active" : ""}`}
          onClick={() => setStyleOpen((o) => !o)}
          title="Text style"
        >
          aA
        </button>
        {styleOpen && (
          <div className="cnsl-style-menu" role="menu">
            {TYPE_STYLES.map((s) => (
              <button
                key={s.label}
                type="button"
                role="menuitem"
                className={`cnsl-tstyle ${s.className ?? ""}${
                  s.isActive(editor) ? " is-active" : ""
                }`}
                onClick={() => {
                  s.run(editor);
                  setStyleOpen(false);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="cnsl-tb-sep" aria-hidden />

      {/* Inline marks */}
      <button
        type="button"
        className={`cnsl-tb-btn${editor.isActive("bold") ? " is-active" : ""}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
        style={{ fontWeight: 700 }}
      >
        B
      </button>
      <button
        type="button"
        className={`cnsl-tb-btn${editor.isActive("italic") ? " is-active" : ""}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
        style={{ fontStyle: "italic" }}
      >
        I
      </button>
      <button
        type="button"
        className={`cnsl-tb-btn${editor.isActive("underline") ? " is-active" : ""}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
        style={{ textDecoration: "underline" }}
      >
        U
      </button>
      <button
        type="button"
        className={`cnsl-tb-btn${editor.isActive("strike") ? " is-active" : ""}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
        style={{ textDecoration: "line-through" }}
      >
        S
      </button>
      <button
        type="button"
        className={`cnsl-tb-btn${editor.isActive("link") ? " is-active" : ""}`}
        onClick={setLink}
        title="Link"
      >
        🔗
      </button>

      <span className="cnsl-tb-sep" aria-hidden />

      {/* Alignment */}
      {(["left", "center", "right"] as const).map((align) => (
        <button
          key={align}
          type="button"
          className={`cnsl-tb-btn${
            editor.isActive({ textAlign: align }) ? " is-active" : ""
          }`}
          onClick={() => editor.chain().focus().setTextAlign(align).run()}
          title={`Align ${align}`}
        >
          <AlignIcon align={align} />
        </button>
      ))}

      {/* Right end: current style label + export buttons (12px from the edge) */}
      <div className="cnsl-tb-right">
        {activeStyle && (
          <span className="cnsl-tb-current" title="Current style">
            {activeStyle.label}
          </span>
        )}
        <button type="button" className="cnsl-tb-out" onClick={copyMD} title="Copy as Markdown">
          {copied ? "Copied" : "Copy MD"}
        </button>
        {/* "Save MD" hidden per user — restore this button + the saveMD handler to bring it back.
        <button type="button" className="cnsl-tb-out" onClick={saveMD} title="Save as Markdown">
          Save MD
        </button>
        */}
        <button type="button" className="cnsl-tb-out" onClick={saveRTF} title="Save as RTF">
          Save RTF
        </button>
      </div>
    </div>
  );
}

function AlignIcon({ align }: { align: "left" | "center" | "right" }) {
  // 4 horizontal lines; the short ones shift per alignment.
  const rows =
    align === "left"
      ? [14, 8, 12, 8]
      : align === "center"
      ? [14, 10, 14, 10]
      : [14, 8, 12, 8];
  const x = (w: number) =>
    align === "left" ? 1 : align === "center" ? (14 - w) / 2 + 1 : 14 - w + 1;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      {rows.map((w, i) => (
        <rect
          key={i}
          x={x(w)}
          y={3 + i * 3}
          width={w}
          height={1.6}
          rx={0.8}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
