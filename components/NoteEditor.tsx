"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import NoteToolbar from "./NoteToolbar";

// Paragraph that carries an optional `class` (used by the "Caption" type style).
// Now that the body is stored as HTML, the class round-trips via getHTML/
// setContent, so a Caption survives reload and reaches the published page.
const ClassParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (el) => el.getAttribute("class"),
        renderHTML: (attrs) => (attrs.class ? { class: attrs.class } : {}),
      },
    };
  },
  // Markdown has no representation for an empty paragraph, so the markdown
  // serializer used by the "Copy MD" export would drop blank lines. Emit a
  // `&nbsp;` paragraph instead so vertical spacing survives that export.
  // (HTML storage keeps blank `<p>` as-is, independent of this.)
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          if (node.textContent.trim() === "") {
            state.write("&nbsp;");
            state.closeBlock(node);
            return;
          }
          state.renderInline(node);
          state.closeBlock(node);
        },
      },
    };
  },
});

// WYSIWYG editor. Body is stored as HTML (editor.getHTML()), which round-trips
// losslessly — alignment, captions, blank lines and underline all survive, unlike
// the old Markdown storage. tiptap-markdown stays loaded only so "Copy MD" can
// still emit Markdown. Loading is format-agnostic: the markdown parser runs with
// html:true, so it parses legacy Markdown bodies AND passes new HTML through, which
// migrates old notes to HTML on their first edit. Images are by reference (URL)
// only — no upload. Switching notes reloads the content.
export default function NoteEditor({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (html: string) => void;
  title?: string; // used for export filenames
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      ClassParagraph,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      // Images by URL only (no upload). allowBase64 off so inline data: blobs
      // never bloat the markdown body / the /api/state sync payload.
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Markdown,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "cnsl-prose" } },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Load a different note's content when the selection changes (no echo loop:
  // skip when the editor already holds this HTML). setContent routes through the
  // markdown parser (html:true), so a legacy Markdown body is parsed and an HTML
  // body passes through unchanged.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    // `cnsl-notepad` namespaces every editor + toolbar style so nothing the
    // NotePad defines can leak into (or be affected by) the rest of the app UI.
    <div
      className="cnsl-notepad"
      style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 }}
    >
      <NoteToolbar editor={editor} title={title} />
      {/* The editing surface mirrors the published article 1:1: data-theme="mono"
          gives this subtree the same lavender-on-dark ramp as /note/…, and the
          content uses the same type scale, so what you write looks exactly like
          what gets published. */}
      <div className="cnsl-notepad-paper" data-theme="mono">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
