"use client";

import type { PublicGameState, ChatChannel } from "@/lib/types";
import type { Socket } from "socket.io-client";
import { ChatPanel } from "@/components/game/ChatPanel";
import { FiveAliveGameLog } from "./FiveAliveGameLog";

export function FiveAliveSidebar({
  state,
  socket,
  onSend,
  enableVoice,
  joinVoiceRequest,
  onVoiceJoined,
  logTitle = "Game log",
}: {
  state: PublicGameState;
  socket: Socket;
  onSend: (channel: ChatChannel, text: string) => void;
  enableVoice?: boolean;
  joinVoiceRequest?: { nonce: number; channel: ChatChannel } | null;
  onVoiceJoined?: (channel: ChatChannel) => void;
  logTitle?: string;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <FiveAliveGameLog logs={state.logs} title={logTitle} />
      <div className="max-md:hidden">
        <ChatPanel
          state={state}
          socket={socket}
          onSend={onSend}
          enableVoice={enableVoice}
          joinVoiceRequest={joinVoiceRequest}
          onVoiceJoined={onVoiceJoined}
        />
      </div>
    </div>
  );
}
