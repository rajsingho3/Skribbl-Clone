import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import logo from "../assets/logo.gif";

type Player = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
};

type RoomSettings = {
  maxPlayers: number;
  rounds: number;
  drawingTime: number;
  wordCount: number;
  hintsenbled: boolean;
};

const RESOLVED_SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;

export function Room() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const fallbackNameRef = useRef(`Player-${Math.floor(Math.random() * 9000 + 1000)}`);
  const hostMode = params.get("host") === "1";
  const initialRoomId = params.get("roomId") ?? "";
  const playerName = params.get("name")?.trim() || fallbackNameRef.current;

  const [roomId, setRoomId] = useState(initialRoomId);
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState("Connecting...");
  const [phase, setPhase] = useState("WAITING");
  const [roundLabel, setRoundLabel] = useState("Round 1 of 3");
  const [wordHint, setWordHint] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [settings] = useState<RoomSettings>({
    maxPlayers: 8,
    rounds: 3,
    drawingTime: 80,
    wordCount: 3,
    hintsenbled: true,
  });

  const socketRef = useRef<Socket | null>(null);
  const hasCreatedRoomRef = useRef(false);
  const currentRoomIdRef = useRef(initialRoomId);

  useEffect(() => {
    const socket = io(RESOLVED_SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 2500,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus(`Connected (${socket.id})`);

      const targetRoomId = currentRoomIdRef.current || initialRoomId;
      if (targetRoomId) {
        socket.emit("join_room", {
          roomId: targetRoomId,
          playerName,
        });
      } else if (hostMode && !hasCreatedRoomRef.current) {
        hasCreatedRoomRef.current = true;
        socket.emit("create_room", {
          hostName: playerName,
          settings,
        });
      }
    });

    socket.on("room_created", ({ roomId: createdId, players: roomPlayers }) => {
      hasCreatedRoomRef.current = true;
      currentRoomIdRef.current = createdId;
      setRoomId(createdId);
      setPlayers(roomPlayers);
      setStatus("Private room created");

      const next = new URLSearchParams(window.location.search);
      next.set("roomId", createdId);
      next.set("host", "1");
      next.set("name", playerName);
      window.history.replaceState({}, "", `/room?${next.toString()}`);
    });

    socket.on("room_joined", ({ roomId: joinedRoomId, players: roomPlayers }) => {
      currentRoomIdRef.current = joinedRoomId;
      setRoomId(joinedRoomId);
      setPlayers(roomPlayers);
      setStatus(`Joined room ${joinedRoomId}`);
    });

    socket.on("player_joined", ({ players: roomPlayers }) => {
      setPlayers(roomPlayers);
      setStatus(`${roomPlayers.length} players connected`);
    });

    socket.on("players_updated", ({ players: roomPlayers }) => {
      setPlayers(roomPlayers);
    });

    socket.on("game_state", ({ phase: nextPhase, round, drawerName: nextDrawer, wordHint: hint }) => {
      setPhase(nextPhase);
      setRoundLabel(`Round ${round} of ${settings.rounds}`);
      setDrawerName(nextDrawer ?? null);
      setWordHint(hint ?? null);
      setStatus(nextPhase === "GAME_OVER" ? "Game over" : "Game in progress");
    });

    socket.on("chat_message", ({ playerName: sender, message, correct }: { playerName: string; message: string; correct: boolean }) => {
      const prefix = correct ? "Correct" : "Guess";
      setMessages((prev) => [`${prefix} - ${sender}: ${message}`, ...prev].slice(0, 25));
    });

    socket.on("error", (message: string) => {
      setStatus(`Error: ${message}`);
    });

    socket.on("connect_error", (error: Error) => {
      setStatus(`Connection error: ${error.message}`);
    });

    socket.on("disconnect", (reason: string) => {
      setStatus(`Disconnected: ${reason}`);
    });

    socket.io.on("reconnect_attempt", (attempt: number) => {
      setStatus(`Reconnecting... attempt ${attempt}`);
    });

    socket.io.on("reconnect", () => {
      setStatus("Reconnected");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const inviteLink = useMemo(() => {
    if (!roomId) return "";
    const base = window.location.origin;
    return `${base}/room?roomId=${encodeURIComponent(roomId)}`;
  }, [roomId]);

  const handleStart = () => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit("start_game", { roomId });
  };

  const handleInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setStatus("Could not copy invite link");
    }
  };

  const handleGuessSubmit = () => {
    const text = guess.trim();
    if (!text || !roomId || !socketRef.current) return;
    socketRef.current.emit("submit_guess", { roomId, guess: text });
    setGuess("");
  };

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-[1500px]">
        <img src={logo} alt="skribbl logo" className="mb-4" />

        <div className="mb-2 flex h-14 items-center justify-between rounded border-4 border-[#1b4da7] bg-[#f2f2f2] px-5 text-black">
          <p className="text-3xl font-bold">{roundLabel}</p>
          <p className="text-xl font-bold tracking-wider">{phase}</p>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <aside className="col-span-12 rounded border-4 border-[#1b4da7] bg-white p-3 text-black md:col-span-2">
            <p className="mb-2 text-xl font-bold">Players</p>
            <div className="space-y-2">
              {players.length === 0 ? <p className="text-sm">Waiting for players...</p> : null}
              {players.map((p, idx) => (
                <div key={p.id} className="rounded bg-[#edf3ff] px-2 py-1">
                  <p className="font-bold">
                    #{idx + 1} {p.name} {p.isHost ? "(Host)" : ""}
                  </p>
                  <p>{p.score ?? 0} points</p>
                </div>
              ))}
            </div>
          </aside>

          <main className="col-span-12 rounded border-4 border-[#1b4da7] bg-[#3b405a] p-4 md:col-span-7">
            <div className="grid grid-cols-2 gap-3 text-lg">
              <label>Players</label>
              <select className="rounded bg-white px-3 py-2 text-black" value={settings.maxPlayers} disabled>
                <option>8</option>
              </select>
              <label>Language</label>
              <select className="rounded bg-white px-3 py-2 text-black" value="English" disabled>
                <option>English</option>
              </select>
              <label>Drawtime</label>
              <select className="rounded bg-white px-3 py-2 text-black" value={settings.drawingTime} disabled>
                <option>80</option>
              </select>
              <label>Rounds</label>
              <select className="rounded bg-white px-3 py-2 text-black" value={settings.rounds} disabled>
                <option>3</option>
              </select>
              <label>Word Count</label>
              <select className="rounded bg-white px-3 py-2 text-black" value={settings.wordCount} disabled>
                <option>3</option>
              </select>
              <label>Hints</label>
              <select className="rounded bg-white px-3 py-2 text-black" value={settings.hintsenbled ? 2 : 0} disabled>
                <option>{settings.hintsenbled ? "2" : "0"}</option>
              </select>
            </div>

            <div className="mt-3 rounded bg-white p-3 text-black">
              <p className="text-base">Room ID: {roomId || "Creating..."}</p>
              <p className="text-base">Status: {status}</p>
              <p className="text-base">Drawer: {drawerName ?? "-"}</p>
              <p className="text-base">Word Hint: {wordHint ?? "-"}</p>
              <p className="truncate text-base">Invite Link: {inviteLink || "Waiting..."}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={handleStart}
                disabled={!roomId}
                className="rounded bg-green-500 py-3 text-4xl font-bold text-white disabled:opacity-50"
              >
                Start!
              </button>
              <button onClick={handleInvite} disabled={!inviteLink} className="rounded bg-blue-500 py-3 text-4xl font-bold">
                {copied ? "Copied" : "Invite"}
              </button>
            </div>
          </main>

          <section className="col-span-12 rounded border-4 border-[#1b4da7] bg-white p-2 text-black md:col-span-3">
            <p className="mb-2 text-orange-500">{playerName} is now in the room.</p>
            <div className="h-[480px] overflow-y-auto rounded border border-gray-200 p-2 text-sm">
              {messages.length === 0 ? <p className="text-slate-500">No guesses yet.</p> : null}
              {messages.map((message, index) => (
                <p key={`${message}-${index}`} className="mb-1">
                  {message}
                </p>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGuessSubmit();
                  }
                }}
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Type your guess here..."
              />
              <button onClick={handleGuessSubmit} className="rounded bg-blue-600 px-3 py-2 text-white">
                Send
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
