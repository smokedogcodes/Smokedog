"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatChannel, VoiceSignalPayload } from "@/lib/types";
import type { GameSocket } from "@/lib/socket/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const SPEAK_THRESHOLD = 0.018;

type PeerState = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  pendingIce: RTCIceCandidateInit[];
};

/**
 * Mesh voice with perfect-negotiation (deterministic polite peer) so both
 * sides joining at once don't glare each other into silence.
 */
export function useVoiceChat(
  socket: GameSocket | null,
  roomId: string,
  playerId: string | undefined,
  channel: ChatChannel | null,
  enabled: boolean,
  playerNames?: Record<string, string>
) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const channelRef = useRef<ChatChannel | null>(null);
  const speakingRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;

  const ensureAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const state = peersRef.current.get(peerId);
    state?.pc.close();
    peersRef.current.delete(peerId);
    analysersRef.current.delete(peerId);
    speakingRef.current.delete(peerId);
    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      remoteAudioRef.current.delete(peerId);
    }
  }, []);

  const cleanupAll = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    for (const id of [...peersRef.current.keys()]) cleanupPeer(id);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setJoined(false);
    setParticipants([]);
    setSpeakingIds([]);
    speakingRef.current.clear();
  }, [cleanupPeer]);

  const attachAnalyser = useCallback(
    async (peerId: string, stream: MediaStream) => {
      try {
        const ctx = await ensureAudioCtx();
        const existing = analysersRef.current.get(peerId);
        if (existing) return;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysersRef.current.set(peerId, analyser);
      } catch {
        /* analyser unavailable */
      }
    },
    [ensureAudioCtx]
  );

  const attachRemote = useCallback(
    async (peerId: string, stream: MediaStream) => {
      let audio = remoteAudioRef.current.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
          true;
        audio.setAttribute("playsinline", "true");
        audio.dataset.peer = peerId;
        document.body.appendChild(audio);
        remoteAudioRef.current.set(peerId, audio);
      }
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      try {
        await audio.play();
      } catch {
        /* join gesture should unlock; retry once */
        setTimeout(() => void audio?.play().catch(() => undefined), 200);
      }
      await attachAnalyser(peerId, stream);
    },
    [attachAnalyser]
  );

  const emitSpeaking = useCallback(
    (speaking: boolean) => {
      if (!socket || !channelRef.current || !playerIdRef.current) return;
      socket.emit("voice:speaking", {
        roomId,
        channel: channelRef.current,
        speaking,
      });
    },
    [socket, roomId]
  );

  const monitorLevels = useCallback(() => {
    const nextSpeaking = new Set<string>();
    const data = new Uint8Array(256);
    const selfId = playerIdRef.current;

    if (selfId && localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track?.enabled) {
        const localAnalyser = analysersRef.current.get("__local__");
        if (localAnalyser) {
          localAnalyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
          if (avg > SPEAK_THRESHOLD) nextSpeaking.add(selfId);
        }
      }
    }

    for (const [peerId, analyser] of analysersRef.current) {
      if (peerId === "__local__") continue;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      if (avg > SPEAK_THRESHOLD) nextSpeaking.add(peerId);
    }

    const prevLocal = speakingRef.current.has(selfId ?? "");
    const nextLocal = selfId ? nextSpeaking.has(selfId) : false;
    if (selfId && prevLocal !== nextLocal) emitSpeaking(nextLocal);

    speakingRef.current = nextSpeaking;
    setSpeakingIds([...nextSpeaking]);
    rafRef.current = requestAnimationFrame(monitorLevels);
  }, [emitSpeaking]);

  const ensurePeer = useCallback(
    (peerId: string): PeerState | null => {
      if (!localStreamRef.current || !playerIdRef.current) return null;
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const polite = playerIdRef.current < peerId;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const state: PeerState = {
        pc,
        makingOffer: false,
        ignoreOffer: false,
        polite,
        pendingIce: [],
      };
      peersRef.current.set(peerId, state);

      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        void attachRemote(peerId, stream);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !socket || !channelRef.current) return;
        socket.emit("voice:signal", {
          roomId,
          channel: channelRef.current,
          targetId: peerId,
          signal: { type: "ice", candidate: ev.candidate.toJSON() },
        });
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          cleanupPeer(peerId);
        }
      };

      return state;
    },
    [attachRemote, cleanupPeer, roomId, socket]
  );

  const makeOffer = useCallback(
    async (peerId: string) => {
      const state = ensurePeer(peerId);
      if (!state || !socket || !channelRef.current) return;
      // Impolite peer always offers; polite waits for remote offer.
      if (state.polite) return;
      try {
        state.makingOffer = true;
        await state.pc.setLocalDescription(await state.pc.createOffer());
        socket.emit("voice:signal", {
          roomId,
          channel: channelRef.current,
          targetId: peerId,
          signal: { type: "offer", sdp: state.pc.localDescription! },
        });
      } catch {
        cleanupPeer(peerId);
      } finally {
        state.makingOffer = false;
      }
    },
    [cleanupPeer, ensurePeer, roomId, socket]
  );

  const flushIce = useCallback(async (state: PeerState) => {
    if (!state.pc.remoteDescription) return;
    const queued = [...state.pendingIce];
    state.pendingIce = [];
    for (const candidate of queued) {
      try {
        await state.pc.addIceCandidate(candidate);
      } catch {
        /* stale */
      }
    }
  }, []);

  const handleSignal = useCallback(
    async (fromId: string, signal: VoiceSignalPayload) => {
      if (!localStreamRef.current || !playerIdRef.current) return;
      const state = ensurePeer(fromId);
      if (!state) return;
      const { pc } = state;

      try {
        if (signal.type === "offer") {
          const offerCollision =
            state.makingOffer || pc.signalingState !== "stable";
          state.ignoreOffer = !state.polite && offerCollision;
          if (state.ignoreOffer) return;
          await pc.setRemoteDescription(signal.sdp);
          await flushIce(state);
          await pc.setLocalDescription(await pc.createAnswer());
          socket?.emit("voice:signal", {
            roomId,
            channel: channelRef.current!,
            targetId: fromId,
            signal: { type: "answer", sdp: pc.localDescription! },
          });
          return;
        }

        if (signal.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(signal.sdp);
            await flushIce(state);
          }
          return;
        }

        if (signal.type === "ice" && signal.candidate) {
          if (!pc.remoteDescription) {
            state.pendingIce.push(signal.candidate);
          } else {
            try {
              await pc.addIceCandidate(signal.candidate);
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        cleanupPeer(fromId);
      }
    },
    [cleanupPeer, ensurePeer, flushIce, roomId, socket]
  );

  useEffect(() => {
    if (!socket || !enabled) {
      cleanupAll();
      channelRef.current = null;
      return;
    }

    const onParticipants = (payload: {
      channel: ChatChannel;
      participantIds: string[];
    }) => {
      if (payload.channel !== channelRef.current || !playerIdRef.current) return;
      const selfId = playerIdRef.current;
      const others = payload.participantIds.filter((id) => id !== selfId);
      setParticipants(payload.participantIds);
      if (payload.participantIds.includes(selfId) && localStreamRef.current) {
        setJoined(true);
        setError(null);
      }
      if (!localStreamRef.current) return;
      for (const id of others) {
        void makeOffer(id);
      }
      for (const id of peersRef.current.keys()) {
        if (!others.includes(id)) cleanupPeer(id);
      }
    };

    const onSignal = (payload: {
      channel: ChatChannel;
      fromId: string;
      signal: VoiceSignalPayload;
    }) => {
      if (payload.channel !== channelRef.current) return;
      void handleSignal(payload.fromId, payload.signal);
    };

    const onSpeaking = (payload: {
      channel: ChatChannel;
      playerId: string;
      speaking: boolean;
    }) => {
      if (payload.channel !== channelRef.current) return;
      if (payload.playerId === playerIdRef.current) return;
      if (payload.speaking) speakingRef.current.add(payload.playerId);
      else speakingRef.current.delete(payload.playerId);
      setSpeakingIds([...speakingRef.current]);
    };

    const onError = ({ message }: { message: string }) => {
      setError(message);
      cleanupAll();
      channelRef.current = null;
    };

    socket.on("voice:participants", onParticipants);
    socket.on("voice:signal", onSignal);
    socket.on("voice:speaking", onSpeaking);
    socket.on("voice:error", onError);

    return () => {
      socket.off("voice:participants", onParticipants);
      socket.off("voice:signal", onSignal);
      socket.off("voice:speaking", onSpeaking);
      socket.off("voice:error", onError);
    };
  }, [
    socket,
    enabled,
    makeOffer,
    cleanupPeer,
    handleSignal,
    cleanupAll,
  ]);

  useEffect(() => {
    if (!joined || !localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    if (socket && channelRef.current) {
      socket.emit("voice:muted", {
        roomId,
        channel: channelRef.current,
        muted,
      });
    }
  }, [joined, muted, socket, roomId]);

  useEffect(() => {
    if (!socket) return;
    const onForcedMute = (payload: {
      channel: ChatChannel;
      playerId: string;
      muted: boolean;
    }) => {
      if (payload.playerId !== playerIdRef.current) return;
      if (payload.channel !== channelRef.current) return;
      setMuted(payload.muted);
    };
    socket.on("voice:muted", onForcedMute);
    return () => {
      socket.off("voice:muted", onForcedMute);
    };
  }, [socket]);

  useEffect(() => {
    if (!joined) return;
    rafRef.current = requestAnimationFrame(monitorLevels);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [joined, monitorLevels]);

  // Keep leave/cleanup on unmount or socket swap only — do NOT depend on `joined`
  // or joining flips true→cleanupAll→leave and the avatar vanishes.
  const joinedRef = useRef(false);
  joinedRef.current = joined;

  useEffect(() => {
    return () => {
      if (socket && channelRef.current && joinedRef.current) {
        socket.emit("voice:leave", { roomId, channel: channelRef.current });
      }
      cleanupAll();
    };
  }, [socket, roomId, cleanupAll]);

  const leave = useCallback(() => {
    if (socket && channelRef.current) {
      socket.emit("voice:leave", { roomId, channel: channelRef.current });
    }
    cleanupAll();
  }, [socket, roomId, cleanupAll]);

  const join = useCallback(async () => {
    if (!socket || !channel || !enabled) return;
    setError(null);
    if (joined && channelRef.current === channel) return;
    if (joined) leave();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      channelRef.current = channel;
      setJoined(true);
      setParticipants((prev) =>
        playerIdRef.current && !prev.includes(playerIdRef.current)
          ? [...prev, playerIdRef.current]
          : prev
      );
      await ensureAudioCtx();
      await attachAnalyser("__local__", stream);
      socket.emit("voice:join", { roomId, channel });
    } catch {
      setError("Microphone access denied");
      cleanupAll();
    }
  }, [
    socket,
    channel,
    enabled,
    joined,
    leave,
    roomId,
    cleanupAll,
    attachAnalyser,
    ensureAudioCtx,
  ]);

  useEffect(() => {
    if (!enabled && joined) leave();
  }, [enabled, joined, leave]);

  useEffect(() => {
    if (joined && channel && channelRef.current !== channel) leave();
  }, [channel, joined, leave]);

  const participantLabels = participants.map(
    (id) => playerNames?.[id] ?? "Operator"
  );

  return {
    joined,
    muted,
    setMuted,
    participants,
    participantLabels,
    speakingIds,
    error,
    join,
    leave,
  };
}
