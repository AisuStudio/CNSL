"use client";

// The visual box for a playbook node on the canvas. One generic component
// switches its handle set + subtitle on `data.kind` rather than four near-
// duplicate components — only the chrome differs, not the box itself.

import { Handle, Position, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import type { NodeKind, PlaybookNode } from "@/lib/playbook";

const KIND_MARK: Record<NodeKind, string> = {
  task: "▢",
  skill: "◆",
  output: "▶",
  branch: "?",
};

export interface PlaybookRFData extends Record<string, unknown> {
  kind: NodeKind;
  label: string;
  subtitle?: string;
  isEntry: boolean;
}

export function subtitleFor(n: PlaybookNode): string | undefined {
  switch (n.kind) {
    case "task": {
      const ref = [n.taskProject, n.taskNumber ? `#${n.taskNumber}` : ""]
        .filter(Boolean)
        .join(" ");
      return ref || undefined;
    }
    case "skill":
      return n.body ? n.body.trim().slice(0, 40) + (n.body.trim().length > 40 ? "…" : "") : undefined;
    case "output": {
      const kind = n.outputKind === "feedback" ? "feedback" : "set status";
      return n.outputKind === "feedback" ? kind : `${kind} → ${n.outputStatus ?? "review_input"}`;
    }
    case "branch":
      return undefined;
  }
}

export function labelFor(n: PlaybookNode): string {
  const t = (n.kind === "branch" ? n.question : n.title) ?? "";
  return t.trim() || "Untitled node";
}

export type PlaybookRFNode = Node<PlaybookRFData>;

const boxBase: React.CSSProperties = {
  position: "relative",
  minWidth: "120px",
  maxWidth: "160px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
  padding: "5px 7px",
  fontFamily: "var(--font-family)",
  cursor: "pointer",
};

const handleStyle: React.CSSProperties = {
  width: "7px",
  height: "7px",
  background: "var(--color-text-muted)",
  border: "1.5px solid var(--color-bg-deep)",
};

function PlaybookNodeBox({ data, selected }: NodeProps<PlaybookRFNode>) {
  const isBranch = data.kind === "branch";
  return (
    <div
      style={{
        ...boxBase,
        borderColor: selected ? "var(--color-accent)" : "var(--color-border-subtle)",
        boxShadow: data.isEntry
          ? "0 0 0 1.5px var(--color-running)"
          : selected
          ? "0 0 0 1.5px var(--color-accent)"
          : "none",
      }}
    >
      {!data.isEntry && (
        <Handle type="target" position={Position.Left} id="in" style={handleStyle} />
      )}
      {data.isEntry && (
        <span
          title="Start node"
          style={{
            position: "absolute",
            left: "-7px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "10px",
            color: "var(--color-running)",
          }}
        >
          ⚡
        </span>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: "10px" }}>
          {KIND_MARK[data.kind]}
        </span>
        <span
          style={{
            color: "var(--color-text-primary)",
            fontSize: "11px",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.label}
        </span>
      </div>
      {data.subtitle && (
        <div
          style={{
            marginTop: "2px",
            fontSize: "9px",
            color: "var(--color-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.subtitle}
        </div>
      )}

      {isBranch ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ ...handleStyle, top: "38%", background: "var(--color-running)" }}
          />
          <span
            style={{
              position: "absolute",
              right: "-28px",
              top: "38%",
              transform: "translateY(-50%)",
              fontSize: "9px",
              color: "var(--color-running)",
            }}
          >
            true
          </span>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ ...handleStyle, top: "68%" }}
          />
          <span
            style={{
              position: "absolute",
              right: "-32px",
              top: "68%",
              transform: "translateY(-50%)",
              fontSize: "9px",
              color: "var(--color-text-muted)",
            }}
          >
            false
          </span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="out" style={handleStyle} />
      )}
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  task: PlaybookNodeBox,
  skill: PlaybookNodeBox,
  output: PlaybookNodeBox,
  branch: PlaybookNodeBox,
};
