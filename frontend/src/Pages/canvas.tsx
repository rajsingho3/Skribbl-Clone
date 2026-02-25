import { useRef, useEffect, useState, useCallback } from "react";
import { Socket } from "socket.io-client";

type ToolType = "pen" | "eraser";

interface DrawingCanvasProps {
  isDrawer: boolean;
  socket: Socket | null;
  roomId: string;
}

interface StrokeData {
  type: "start" | "move";
  x: number;
  y: number;
  color: string;
  size: number;
}

export default function DrawingCanvas({ isDrawer, socket, roomId }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef<boolean>(false);
  const currentStrokeColor = useRef<string>("#000000");
  const currentStrokeSize = useRef<number>(5);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const [color] = useState<string>("#000000");
  const [size] = useState<number>(5);
  const [tool] = useState<ToolType>("pen");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctxRef.current = ctx;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(snap);

    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }
  }, []);

  const replayStrokes = useCallback((strokes: StrokeData[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    strokes.forEach((s) => {
      if (s.type === "start") {
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.moveTo(s.x, s.y);
      } else if (s.type === "move") {
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDrawData = (stroke: StrokeData) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.type === "start") {
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.moveTo(stroke.x, stroke.y);
      } else if (stroke.type === "move") {
        ctx.lineTo(stroke.x, stroke.y);
        ctx.stroke();
      }
    };

    const handleCleared = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      historyRef.current = [];
    };

    const handleUndo = ({ strokes }: { strokes: StrokeData[] }) => {
      replayStrokes(strokes);
    };

    const handleCanvasData = ({ strokes }: { strokes: StrokeData[] }) => {
      replayStrokes(strokes);
    };

    socket.on("draw_data", handleDrawData);
    socket.on("canvas_cleared", handleCleared);
    socket.on("canvas_undo", handleUndo);
    socket.on("canvas_data", handleCanvasData);

    return () => {
      socket.off("draw_data", handleDrawData);
      socket.off("canvas_cleared", handleCleared);
      socket.off("canvas_undo", handleUndo);
      socket.off("canvas_data", handleCanvasData);
    };
  }, [socket, replayStrokes]);

  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !roomId) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const pos = getPos(e, canvas);
    isDrawing.current = true;

    saveSnapshot();

    const activeColor = tool === "eraser" ? "#ffffff" : color;
    currentStrokeColor.current = activeColor;
    currentStrokeSize.current = size;

    ctx.beginPath();
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = size;
    ctx.moveTo(pos.x, pos.y);

    socket?.emit("draw_start", { roomId, x: pos.x, y: pos.y, color: activeColor, size });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !isDrawer || !roomId) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const pos = getPos(e, canvas);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    socket?.emit("draw_move", { roomId, x: pos.x, y: pos.y });
  };

  const endDraw = () => {
    if (!isDrawing.current || !isDrawer || !roomId) return;
    isDrawing.current = false;
    socket?.emit("draw_end", { roomId });
  };

  return (
    <div className="h-full w-full rounded bg-white p-2">
      <canvas
        ref={canvasRef}
        width={800}
        height={550}
        className="h-[550px] w-full rounded border-2 border-slate-300 bg-white"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        style={{ cursor: isDrawer ? (tool === "eraser" ? "cell" : "crosshair") : "not-allowed" }}
      />
    </div>
  );
}
