import { isMafiaRole } from "@/lib/games/mafia-city/roles";
import type { ChatChannel, DaySubPhase, Phase, Role } from "@/lib/types";

export const CHANNEL_LABELS: Record<ChatChannel, string> = {
  town: "Public Channel",
  mafia: "Mafia Channel",
  graveyard: "Graveyard",
};

export type ChannelAccessOpts = {
  alive: boolean;
  role?: Role;
  blackmailed: boolean;
  phase: Phase;
  daySubPhase?: DaySubPhase;
};

export function canAccessChannel(
  channel: ChatChannel,
  opts: ChannelAccessOpts
): boolean {
  if (channel === "graveyard") return !opts.alive;
  if (channel === "town") {
    if (
      opts.phase === "fivealive_turn" ||
      opts.phase === "fivealive_bomb" ||
      opts.phase === "fivealive_dealing" ||
      opts.phase === "ttt_play" ||
      opts.phase === "spotit_play"
    ) {
      return opts.alive && !opts.blackmailed;
    }
    // Alive town chat (send+read) during day
    if (
      opts.alive &&
      opts.phase === "day" &&
      !opts.blackmailed &&
      (opts.daySubPhase === "discussion" ||
        opts.daySubPhase === "vote" ||
        !opts.daySubPhase)
    ) {
      return true;
    }
    return false;
  }
  if (channel === "mafia") {
    return (
      opts.alive &&
      opts.phase === "night" &&
      !!opts.role &&
      isMafiaRole(opts.role)
    );
  }
  return false;
}

/** Dead players can view public day chat but not send. */
export function canViewTownChat(opts: ChannelAccessOpts): boolean {
  if (canAccessChannel("town", opts)) return true;
  return !opts.alive && opts.phase === "day";
}

export function canUseTownVoice(opts: ChannelAccessOpts): boolean {
  return canAccessChannel("town", opts) && opts.daySubPhase !== "vote";
}

export function availableChannels(opts: ChannelAccessOpts): ChatChannel[] {
  const channels: ChatChannel[] = [];
  if (canViewTownChat(opts)) channels.push("town");
  if (canAccessChannel("mafia", opts)) channels.push("mafia");
  if (canAccessChannel("graveyard", opts)) channels.push("graveyard");
  return channels;
}
