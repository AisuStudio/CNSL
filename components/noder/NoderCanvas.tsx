"use client";

// The React Flow canvas for a playbook. `PlaybookNode[]` (from NoderView's
// draft state) stays the single source of truth — this component only derives
// a React Flow view from it and writes user actions (drag, connect, delete)
// back up via onPatchNode. React Flow's own useNodesState/useEdgesState is a
// transient rendering cache, not a second store: every drag/connect ends by
// calling onPatchNode, which flows back into `nodes`, which re-derives the RF
// view via useMemo below — closing the loop.

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeOutEdges, type NodeKind, type PlaybookNode } from "@/lib/playbook";
import { nodeTypes, labelFor, subtitleFor, type PlaybookRFNode } from "./nodeTypes";
import { secondaryBtn } from "./style";

function handleField(handle: string): "next" | "onTrue" | "onFalse" {
  if (handle === "true") return "onTrue";
  if (handle === "false") return "onFalse";
  return "next";
}

export default function NoderCanvas({
  nodes,
  entryId,
  selectedId,
  onPatchNode,
  onSelect,
  onAddNode,
}: {
  nodes: PlaybookNode[];
  entryId: string;
  selectedId: string | null;
  onPatchNode: (id: string, patch: Partial<PlaybookNode>) => void;
  onSelect: (id: string | null) => void;
  onAddNode: (kind: NodeKind) => void;
}) {
  const initialFit = useRef(false);

  const rfNodesFromDraft = useMemo<PlaybookRFNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: { x: n.x ?? 0, y: n.y ?? 0 },
        selected: n.id === selectedId,
        data: {
          kind: n.kind,
          label: labelFor(n),
          subtitle: subtitleFor(n),
          isEntry: n.id === entryId,
        },
      })),
    [nodes, selectedId, entryId]
  );

  const rfEdgesFromDraft = useMemo<Edge[]>(
    () =>
      nodes.flatMap((n) =>
        nodeOutEdges(n).map((e) => ({
          id: `${n.id}:${e.handle}->${e.targetId}`,
          source: n.id,
          sourceHandle: e.handle,
          target: e.targetId,
          targetHandle: "in",
          style: {
            stroke:
              e.handle === "true"
                ? "var(--color-running)"
                : e.handle === "false"
                ? "var(--color-border-subtle)"
                : "var(--color-accent)",
            strokeWidth: 1.5,
          },
        }))
      ),
    [nodes]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(rfNodesFromDraft);
  const [rfEdges, setRfEdges, onEdgesChangeInternal] = useEdgesState(rfEdgesFromDraft);

  // Draft state (via nodes/selectedId/entryId) is the source of truth — keep
  // RF's rendering cache in sync whenever it changes underneath us.
  useEffect(() => setRfNodes(rfNodesFromDraft), [rfNodesFromDraft, setRfNodes]);
  useEffect(() => setRfEdges(rfEdgesFromDraft), [rfEdgesFromDraft, setRfEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<PlaybookRFNode>[]) => {
      onNodesChange(changes);
      for (const c of changes) {
        if (c.type === "position" && c.dragging === false && c.position) {
          onPatchNode(c.id, { x: c.position.x, y: c.position.y });
        }
        if (c.type === "select" && c.selected) onSelect(c.id);
      }
    },
    [onNodesChange, onPatchNode, onSelect]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChangeInternal(changes);
      for (const c of changes) {
        if (c.type === "remove") {
          const edge = rfEdges.find((e) => e.id === c.id);
          if (edge?.sourceHandle) {
            onPatchNode(edge.source, { [handleField(edge.sourceHandle)]: undefined });
          }
        }
      }
    },
    [onEdgesChangeInternal, onPatchNode, rfEdges]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) return;
      if (connection.source === connection.target) return; // no self-loops
      onPatchNode(connection.source, {
        [handleField(connection.sourceHandle)]: connection.target,
      });
    },
    [onPatchNode]
  );

  const handlePaneClick = useCallback(() => onSelect(null), [onSelect]);

  return (
    <div
      className="cnsl-noder-canvas"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100%",
        minHeight: "480px",
        borderRadius: "10px",
        border: "1px solid var(--color-border)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 5,
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={() => onAddNode("task")} style={secondaryBtn}>+ Task</button>
        <button type="button" onClick={() => onAddNode("skill")} style={secondaryBtn}>+ Skill</button>
        <button type="button" onClick={() => onAddNode("output")} style={secondaryBtn}>+ Output</button>
        <button type="button" onClick={() => onAddNode("branch")} style={secondaryBtn}>+ Branch</button>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        onInit={(instance) => {
          if (!initialFit.current) {
            initialFit.current = true;
            // Cap zoom so a sparse (1-2 node) playbook doesn't get blown up to
            // fill the viewport — fitView with no ceiling zooms in as far as
            // padding allows, which made small boxes look huge.
            instance.fitView({ padding: 0.2, maxZoom: 1 });
          }
        }}
        isValidConnection={(c) => c.source !== c.target}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-border)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
