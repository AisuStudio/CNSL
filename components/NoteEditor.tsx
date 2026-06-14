"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import type { MarkdownSerializerState } from "@tiptap/pm/markdown";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import NoteToolbar from "./NoteToolbar";

// Paragraph that carries an optional `class` (used by the "Caption" type style).
// Editor-only: the class is not preserved by the markdown serializer, so a
// Caption reverts to a plain paragraph after reload (acceptable for Phase A).
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
  // Preserve blank paragraphs (the user presses Enter to create vertical spacing).
  // Markdown has no representation for "empty paragraph", so the default serializer
  // drops them on the round-trip (getMarkdown → setContent) and the spacing is lost
  // after leaving the note. Emit a `&nbsp;` paragraph instead so it survives the
  // reparse (markdown-it → a paragraph holding a non-breaking space, which still
  // counts as empty here → re-emits `&nbsp;`) and renders as a gap on the public page.
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

// WYSIWYG editor. Body is stored as Markdown (no images). Switching notes
// resets the content; typing serialises back to Markdown via tiptap-markdown.
export default function NoteEditor({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (markdown: string) => void;
  title?: string; // used for export filenames
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      ClassParagraph,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Markdown,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: { attributes: { class: "cnsl-prose" } },
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());
    },
  });

  // Load a different note's content when the selection changes (no echo loop:
  // skip when the editor already holds this markdown).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 }}>
      <NoteToolbar editor={editor} title={title} />
      <EditorContent editor={editor} />
    </div>
  );
}
