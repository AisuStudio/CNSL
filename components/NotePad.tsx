"use client";

import { useState } from "react";
import type { Note } from "@/lib/notes";
import NoteEditor from "./NoteEditor";

export default function NotePad({
  notes,
  onCreate,
  onUpdate,
  onDelete,
}: {
  notes: Note[];
  onCreate: () => string;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...notes].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    sorted[0]?.id ?? null
  );
  const selected = notes.find((n) => n.id === selectedId) ?? null;

  function newNote() {
    setSelectedId(onCreate());
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Note list */}
      <div
        className="cnsl-scroll"
        style={{
          width: "240px",
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
          type="button"
          onClick={newNote}
          style={{
            margin: "12px",
            height: "36px",
            borderRadius: "8px",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-text-primary)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            cursor: "pointer",
          }}
        >
          + New note
        </button>
        {sorted.length === 0 && (
          <div style={{ padding: "0 14px", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            No notes yet.
          </div>
        )}
        {sorted.map((n) => {
          const active = n.id === selectedId;
          const snippet = (n.body || "").replace(/[#*`>_\-]/g, "").trim();
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                cursor: "pointer",
                background: active ? "var(--color-surface)" : "transparent",
                borderLeft: `3px solid ${active ? "var(--color-accent)" : "transparent"}`,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: "var(--text-base)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {n.title || "Untitled"}
              </span>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {snippet || "Empty"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div
        className="cnsl-scroll"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: "20px 24px 104px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {selected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input
                value={selected.title}
                onChange={(e) => onUpdate(selected.id, { title: e.target.value })}
                placeholder="Title"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--color-text-primary)",
                  fontSize: "24px",
                  fontWeight: 700,
                  fontFamily: "var(--font-family)",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  onDelete(selected.id);
                  setSelectedId(null);
                }}
                title="Delete note"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  color: "var(--color-text-muted)",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  flexShrink: 0,
                }}
              >
                Delete
              </button>
            </div>
            <NoteEditor
              key={selected.id}
              value={selected.body}
              onChange={(md) => onUpdate(selected.id, { body: md })}
            />
          </>
        ) : (
          <div style={{ color: "var(--color-text-muted)", margin: "auto" }}>
            Select a note, or create one.
          </div>
        )}
      </div>
    </div>
  );
}
