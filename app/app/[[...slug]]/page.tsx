// Route shell for /app and /app/<slug> (optional catch-all). This server file
// exists only to declare the static params (needed for the GitHub Pages static
// export) and to mount the client app. All app logic lives in AppClient.
import { TOOL_DEFS, VIEW_DEFS } from "@/components/viewDefs";
import AppClient from "./AppClient";

// Enumerate every reachable slug so `output: export` pre-renders them all:
// the index (/app) plus one page per tool / tracker sub-view.
export function generateStaticParams() {
  const slugs = [
    ...TOOL_DEFS.map((t) => t.key),
    ...VIEW_DEFS.map((v) => v.key),
  ];
  return [{ slug: [] as string[] }, ...slugs.map((s) => ({ slug: [s] }))];
}

export default function Page() {
  return <AppClient />;
}
