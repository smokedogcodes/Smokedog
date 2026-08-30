"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { PrimaryButton } from "@/components/ui/primitives";
import { AVATAR_COUNT } from "@/lib/profile";
import { validateRoomCode } from "@/lib/room-code";

import { gameLabel } from "@/lib/games/labels";

export function ProfileModal({
  open,
  defaultName,
  defaultAvatar,
  createGameId,
  error,
  initialCode,
  initialMode,
  pending = null,
  profileOnly = false,
  onClose,
  onCreate,
  onJoin,
  onSaveProfile,
}: {
  open: boolean;
  defaultName: string;
  defaultAvatar: number;
  createGameId?: string;
  error?: string | null;
  initialCode?: string;
  initialMode?: "create" | "join";
  pending?: "create" | "join" | null;
  /** Homepage edit — save name/avatar without joining. */
  profileOnly?: boolean;
  onClose: () => void;
  onCreate: (name: string, avatarId: number, opts?: { localMode?: boolean }) => void;
  onJoin: (name: string, avatarId: number, code: string) => void;
  onSaveProfile?: (name: string, avatarId: number) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [avatarId, setAvatarId] = useState(defaultAvatar);
  const [code, setCode] = useState("");
  const [localMode, setLocalMode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setAvatarId(defaultAvatar);
      setLocalError(null);
      setCode(initialCode ?? "");
      setLocalMode(false);
      if (initialMode === "join") {
        requestAnimationFrame(() => codeRef.current?.focus());
      }
    }
  }, [open, defaultName, defaultAvatar, initialCode, initialMode]);

  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  const displayError = localError || error;
  const ready = name.trim().length >= 2;
  const isPending = pending !== null;
  const pendingLabel =
    pending === "create"
      ? "Creating party…"
      : pending === "join"
        ? "Joining party…"
        : null;
  const joining = !profileOnly && code.trim().length > 0;
  const showLocalToggle =
    !profileOnly && !joining && createGameId === "mafia-city";

  const title = profileOnly
    ? "Edit profile"
    : joining
      ? "Join with code"
      : createGameId
        ? `Open ${gameLabel(createGameId)}`
        : "Stamp your name";

  const submit = () => {
    if (isPending || !ready) return;
    if (profileOnly) {
      onSaveProfile?.(name.trim(), avatarId);
      return;
    }
    const trimmed = code.trim();
    if (trimmed) {
      const check = validateRoomCode(trimmed);
      if (!check.ok) {
        setLocalError(check.message);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      setLocalError(null);
      onJoin(name.trim(), avatarId, check.code);
    } else {
      setLocalError(null);
      onCreate(name.trim(), avatarId, {
        localMode: showLocalToggle ? localMode : false,
      });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-lenis-prevent
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-[20px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: shake ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl"
          >
            <div className="relative max-h-[min(92vh,920px)] overflow-y-auto border-4 border-crimson/20 bg-manila p-8 text-crimson shadow-2xl md:p-12">
              <button
                onClick={onClose}
                disabled={isPending}
                className="absolute right-4 top-4 text-crimson/70 transition hover:opacity-70 disabled:opacity-40"
                aria-label="Close"
              >
                <X size={24} strokeWidth={2} />
              </button>

              <header className="mb-8 pr-8">
                <h2 className="mb-2 font-mono text-sm font-bold uppercase tracking-[0.2em] text-crimson/80">
                  Intake Form
                </h2>
                <h1 className="mb-2 font-display text-4xl font-bold text-crimson md:text-5xl">
                  {title}
                </h1>
                {!joining && createGameId && (
                  <p className="font-mono text-xs uppercase tracking-[0.1em] text-crimson/60">
                    Game: {gameLabel(createGameId)}
                  </p>
                )}
              </header>

              <div className="space-y-8">
                <div className="space-y-2">
                  <label
                    htmlFor="operator_name"
                    className="block font-mono text-xs font-bold uppercase tracking-[0.1em] text-crimson/70"
                  >
                    Operator Name
                  </label>
                  <input
                    id="operator_name"
                    value={name}
                    maxLength={18}
                    disabled={isPending}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full border-0 border-b border-dashed border-crimson/35 bg-transparent pb-2 font-display text-2xl text-crimson outline-none placeholder:text-crimson/40 focus:border-crimson disabled:opacity-50"
                  />
                </div>

                <div className="space-y-4">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-crimson/70">
                    Mugshot
                  </p>
                  <div className="grid grid-cols-5 justify-items-center gap-2 md:grid-cols-10 md:gap-3">
                    {Array.from({ length: AVATAR_COUNT }, (_, i) => {
                      const selected = avatarId === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isPending}
                          onClick={() => setAvatarId(i)}
                          aria-pressed={selected}
                          aria-label={`Mugshot ${i + 1}`}
                          className={`rounded-full bg-crimson/[0.08] p-0 shadow-sm transition duration-200 disabled:opacity-40 ${
                            selected
                              ? "scale-105 ring-2 ring-crimson"
                              : "ring-2 ring-transparent opacity-85 hover:scale-105 hover:opacity-100"
                          }`}
                        >
                          <span className="block h-12 w-12 md:h-14 md:w-14">
                            <PlayerAvatar id={i} size={56} className="h-full w-full" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showLocalToggle && (
                  <div className="space-y-2">
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-crimson/70">
                      Play mode
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setLocalMode(false)}
                        className={`flex-1 border py-3 font-mono text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-40 ${
                          !localMode
                            ? "border-crimson bg-crimson text-manila"
                            : "border-crimson/25 text-crimson hover:bg-crimson/5"
                        }`}
                      >
                        Online
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setLocalMode(true)}
                        className={`flex-1 border py-3 font-mono text-[10px] font-bold uppercase tracking-widest transition disabled:opacity-40 ${
                          localMode
                            ? "border-crimson bg-crimson text-manila"
                            : "border-crimson/25 text-crimson hover:bg-crimson/5"
                        }`}
                      >
                        Local
                      </button>
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed text-crimson/55">
                      {localMode
                        ? "Same room code on every phone — no chat, voice, or discussion. Outcomes are popups only."
                        : "Full table: chat, voice, and day discussion."}
                    </p>
                  </div>
                )}

                {!profileOnly && (
                <div className="space-y-2">
                  <label
                    htmlFor="room_code"
                    className="block font-mono text-xs font-bold uppercase tracking-[0.1em] text-crimson/70"
                  >
                    Room code{" "}
                    <span className="font-normal normal-case tracking-normal text-crimson/50">
                      (optional)
                    </span>
                  </label>
                  <input
                    ref={codeRef}
                    id="room_code"
                    value={code}
                    maxLength={6}
                    disabled={isPending}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setLocalError(null);
                    }}
                    placeholder="Leave blank to open a room"
                    className={`w-full border-0 border-b border-dashed bg-transparent pb-2 text-center font-mono text-lg tracking-[0.35em] text-crimson outline-none placeholder:tracking-normal placeholder:text-crimson/35 focus:border-crimson disabled:opacity-50 ${
                      displayError ? "border-crimson" : "border-crimson/35"
                    }`}
                  />
                </div>
                )}

                <AnimatePresence>
                  {isPending && pendingLabel && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-crimson/50"
                    >
                      <LoadingSpinner size={14} />
                      {pendingLabel}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {displayError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 font-mono text-xs text-crimson"
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      {displayError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <PrimaryButton
                  className="w-full border border-crimson/90 py-5 text-sm tracking-[0.2em] shadow-lg"
                  loading={isPending}
                  disabled={!ready}
                  onClick={submit}
                >
                  {isPending ? pendingLabel ?? "Processing…" : profileOnly ? "Save profile" : "Stamp in"}
                </PrimaryButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
