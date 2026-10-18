import { useId } from 'react';
import type { Chord } from '../domain/types';

interface ChordDiagramProps {
  chord: Chord;
  compact?: boolean;
}

const paper = '#f6efdf';
const terracotta = '#b9573f';
const pencil = '#302b27';

export default function ChordDiagram({ chord, compact = false }: ChordDiagramProps) {
  const width = compact ? 116 : 148;
  const height = compact ? 144 : 178;
  const left = compact ? 24 : 30;
  const right = width - (compact ? 10 : 12);
  const top = compact ? 42 : 50;
  const bottom = compact ? 122 : 150;
  const stringGap = (right - left) / 5;
  const fretGap = (bottom - top) / 5;
  const instanceId = useId();
  const titleId = `chord-title-${instanceId}`;
  const descriptionId = `chord-description-${instanceId}`;

  return (
    <svg
      className={compact ? 'chord-diagram chord-diagram--compact' : 'chord-diagram'}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      focusable="false"
    >
      <title id={titleId}>{`コード ${chord.name} の押さえ方`}</title>
      <desc id={descriptionId}>{`コード図は左から6弦、5弦、4弦、3弦、2弦、1弦です。${chord.tip}`}</desc>
      <text x={width / 2} y={compact ? 15 : 18} textAnchor="middle" fill={pencil} fontSize={compact ? 15 : 17} fontWeight="700">
        {chord.name}
      </text>
      <text x={width / 2} y={compact ? 27 : 32} textAnchor="middle" fill={pencil} fontSize={compact ? 7 : 8}>
        6弦（太い）← 1弦（細い）
      </text>

      {chord.frets.map((fret, index) => {
        const x = left + stringGap * index;
        const label = fret < 0 ? '×' : fret === 0 ? '○' : '';
        return label ? (
          <text key={`mark-${index}`} x={x} y={top - 8} textAnchor="middle" fill={fret < 0 ? terracotta : pencil} fontSize={compact ? 11 : 13} fontWeight="700">
            {label}
          </text>
        ) : null;
      })}

      {Array.from({ length: 6 }, (_, fretIndex) => {
        const y = top + fretGap * fretIndex;
        return (
          <g key={`fret-${fretIndex}`}>
            <line x1={left} y1={y} x2={right} y2={y} stroke={pencil} strokeWidth={fretIndex === 0 ? 4 : 1.2} />
            {fretIndex < 5 && (
              <text x={left - 7} y={y + fretGap / 2 + 2.5} textAnchor="end" fill={pencil} fontSize={compact ? 7 : 8}>
                {fretIndex + 1}
              </text>
            )}
          </g>
        );
      })}

      {chord.frets.map((_, index) => {
        const x = left + stringGap * index;
        const thickness = 2.4 - index * 0.22;
        return <line key={`string-${index}`} x1={x} y1={top} x2={x} y2={bottom} stroke={pencil} strokeWidth={thickness} />;
      })}

      {chord.frets.map((fret, index) => {
        if (fret <= 0) return null;
        const x = left + stringGap * index;
        const y = top + fretGap * (fret - 0.5);
        const radius = compact ? 6.4 : 7.5;
        return (
          <g key={`finger-${index}`}>
            <circle cx={x} cy={y} r={radius} fill={terracotta} stroke={paper} strokeWidth="1.2" />
            <text x={x} y={y + (compact ? 2.4 : 2.8)} textAnchor="middle" fill={paper} fontSize={compact ? 7 : 8} fontWeight="700">
              {chord.fingers[index]}
            </text>
          </g>
        );
      })}

      <text x={width / 2} y={height - 7} textAnchor="middle" fill={pencil} fontSize={compact ? 7 : 8}>
        × 鳴らさない　○ 開放弦
      </text>
    </svg>
  );
}
