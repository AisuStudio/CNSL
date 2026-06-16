// Note Pad model (board kind='doc'). Body is HTML (legacy notes may still hold
// Markdown; the editor + public renderer handle both and migrate on first edit).
export interface Note {
  id: string;
  folderId?: string | null; // null = root (folders are flat in v1; superseded by `project`)
  title: string;
  body: string; // HTML (editor.getHTML()); legacy notes may be Markdown
  // Sharing-foundation A1: a note belongs to a project and may be linked to a
  // task (the "Story text" case). `project` is a string for now → projectId in A3.
  // The reverse (task → its notes) is DERIVED from taskId (single source of truth).
  project?: string;
  taskId?: string;
  createdAt?: string;
  updatedAt?: string;
  // Public publishing state (server-managed via /api/publish, surfaced read-only
  // to the client so the NotePad can show Publish vs Unpublish).
  published?: boolean;
  topic?: string | null;
  slug?: string | null;
}

// Folder tree (schema ready; no UI in v1).
export interface Folder {
  id: string;
  parentId?: string | null;
  name: string;
  position?: number | null;
}
