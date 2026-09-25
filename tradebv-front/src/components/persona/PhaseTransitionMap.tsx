import React, { useMemo } from 'react';
import type { PersonaPhase } from '@/types/personaStructure';

const WIDTH = 640;
const HEIGHT = 340;
const NODE_W = 148;
const NODE_H = 36;

interface Point {
  x: number;
  y: number;
}

function layout(count: number): Point[] {
  if (count === 1) return [{ x: WIDTH / 2, y: HEIGHT / 2 }];
  const rx = WIDTH / 2 - NODE_W / 2 - 16;
  const ry = HEIGHT / 2 - NODE_H / 2 - 24;
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: WIDTH / 2 + rx * Math.cos(angle), y: HEIGHT / 2 + ry * Math.sin(angle) };
  });
}

/** Point where the segment from the node centre towards `to` leaves the node box. */
function boxExit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const scale = 1 / Math.max(Math.abs(dx) / (NODE_W / 2 + 6), Math.abs(dy) / (NODE_H / 2 + 6), 1e-6);
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function truncate(text: string, max = 20) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function PhaseTransitionMap({
  phases,
  startPhaseId,
  selectedPhaseId,
  onSelect,
}: {
  phases: PersonaPhase[];
  startPhaseId: string;
  selectedPhaseId: string | null;
  onSelect: (phaseId: string) => void;
}) {
  const positions = useMemo(() => layout(phases.length), [phases.length]);
  const indexById = useMemo(() => new Map(phases.map((p, i) => [p.id, i])), [phases]);

  if (phases.length === 0) return null;

  const edges: React.ReactNode[] = [];
  phases.forEach((phase, i) => {
    phase.transitions.forEach(targetId => {
      const j = indexById.get(targetId);
      if (j === undefined) return;
      const highlighted = phase.id === selectedPhaseId;
      const stroke = highlighted ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.45)';
      const marker = highlighted ? 'url(#arrow-active)' : 'url(#arrow)';
      const key = `${phase.id}->${targetId}`;

      if (i === j) {
        const p = positions[i];
        const top = p.y - NODE_H / 2;
        edges.push(
          <path
            key={key}
            d={`M ${p.x + 18} ${top} C ${p.x + 44} ${top - 34}, ${p.x - 44} ${top - 34}, ${p.x - 18} ${top}`}
            fill="none"
            stroke={stroke}
            strokeWidth={highlighted ? 2 : 1.4}
            markerEnd={marker}
          />,
        );
        return;
      }

      const a = positions[i];
      const b = positions[j];
      const start = boxExit(a, b);
      const end = boxExit(b, a);
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      const bend = 22;
      const cx = mx + (-(end.y - start.y) / len) * bend;
      const cy = my + ((end.x - start.x) / len) * bend;
      edges.push(
        <path
          key={key}
          d={`M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`}
          fill="none"
          stroke={stroke}
          strokeWidth={highlighted ? 2 : 1.4}
          markerEnd={marker}
        />,
      );
    });
  });

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Карта переходів між фазами">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground) / 0.6)" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
        </marker>
      </defs>
      {edges}
      {phases.map((phase, i) => {
        const p = positions[i];
        const isSelected = phase.id === selectedPhaseId;
        const isStart = phase.id === startPhaseId;
        return (
          <g
            key={phase.id}
            transform={`translate(${p.x - NODE_W / 2}, ${p.y - NODE_H / 2})`}
            onClick={() => onSelect(phase.id)}
            className="cursor-pointer"
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={10}
              fill={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
              stroke={isStart ? 'hsl(var(--success))' : isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
              strokeWidth={isStart ? 2.5 : 1.5}
            />
            <text
              x={NODE_W / 2}
              y={NODE_H / 2 + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight={500}
              fill={isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'}
            >
              {truncate(phase.name || 'Без назви')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
