"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

// WYSIWYG editor. Body is stored as Markdown (no images). Switching notes
// resets the content; typing serialises back to Markdown via tiptap-markdown.
export default function NoteEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (markdown: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
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

  return <EditorContent editor={editor} />;
}
