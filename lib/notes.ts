// Note Pad model (board kind='doc'). Body is Markdown (no images).
export interface Note {
  id: string;
  folderId?: string | null; // null = root (folders are flat in v1)
  title: string;
  body: string; // markdown
  createdAt?: string;
  updatedAt?: string;
}

// Folder tree (schema ready; no UI in v1).
export interface Folder {
  id: string;
  parentId?: string | null;
  name: string;
  position?: number | null;
}
