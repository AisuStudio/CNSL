// Note Pad model (board kind='doc'). Body is Markdown (no images).
export interface Note {
  id: string;
  folderId?: string | null; // null = root (folders are flat in v1)
  title: string;
  body: string; // markdown
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
