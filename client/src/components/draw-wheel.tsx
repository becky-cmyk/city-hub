import { useRef, useState, useEffect, useCallback } from "react";

interface WheelEntry {
  id: string;
  label: string;
  color?: string;
}

interface DrawWheelProps {
  entries: WheelEntry[];
  winnerId?: string | null;
  onSpinComplete?: (entry: WheelEntry) => void;
  spinning?: boolean;
  size?: number;
}

const WHEEL_COLORS = [
  "#5B1D8F", "#7B2FBF", "#F2C230", "#2563eb", "#059669",
  "#dc2626", "#ea580c", "#0891b2", "#6d28d9", "#be185d",
  "#4f46e5", "#0d9488", "#d97706", "#9333ea", "#e11d48",
  "#1d4ed8",
];

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function DrawWheel({ entries, winnerId, onSpinComplete, spinning = false, size = 400 }: DrawWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef<number>(0);
  const finalRotationRef = useRef(0);

  const sliceCount = Math.max(entries.length, 1);
  const sliceAngle = (2 * Math.PI) / sliceCount;

  const drawWheel = useCallback((currentRotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(currentRotation);

    for (let i = 0; i < sliceCount; i++) {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const color = WHEEL_COLORS[i % WHEEL_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.rotate(midAngle);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";

      const fontSize = Math.max(8, Math.min(14, (radius * 0.7 * sliceAngle) / 2));
      ctx.font = `bold ${fontSize}px -apple-system, system-ui, sans-serif`;

      const label = entries[i]?.label || "";
      const maxLen = Math.floor(radius * 0.55 / (fontSize * 0.55));
      const truncated = label.length > maxLen ? label.substring(0, maxLen - 1) + "..." : label;

      ctx.fillText(truncated, radius * 0.85, fontSize * 0.35);
      ctx.restore();
    }

    ctx.restore();

    const pointerSize = 20;
    ctx.beginPath();
    ctx.moveTo(cx + radius + 4, cy);
    ctx.lineTo(cx + radius - pointerSize, cy - pointerSize / 2);
    ctx.lineTo(cx + radius - pointerSize, cy + pointerSize / 2);
    ctx.closePath();
    ctx.fillStyle = "#F2C230";
    ctx.fill();
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "#F2C230";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [entries, sliceAngle, sliceCount, size]);

  useEffect(() => {
    drawWheel(rotation);
  }, [drawWheel, rotation]);

  useEffect(() => {
    if (!spinning || !winnerId || entries.length === 0) return;

    const winnerIdx = entries.findIndex(e => e.id === winnerId);
    if (winnerIdx === -1) return;

    const targetSliceAngle = -(winnerIdx * sliceAngle + sliceAngle / 2);
    const fullSpins = 5 + Math.random() * 3;
    const targetRotation = targetSliceAngle + fullSpins * 2 * Math.PI;

    const duration = 4000 + Math.random() * 1500;
    const startTime = performance.now();
    const startRotation = rotation;

    setIsAnimating(true);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      const currentRotation = startRotation + (targetRotation - startRotation) * eased;

      setRotation(currentRotation);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        finalRotationRef.current = currentRotation;
        const winner = entries[winnerIdx];
        if (winner && onSpinComplete) {
          onSpinComplete(winner);
        }
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [spinning, winnerId, entries, sliceAngle, onSpinComplete]);

  return (
    <div className="relative inline-block" data-testid="draw-wheel">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="rounded-full"
      />
      {isAnimating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-pulse text-[#F2C230] font-bold text-lg">Spinning...</div>
        </div>
      )}
    </div>
  );
}
