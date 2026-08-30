import { GameClient } from "@/components/game/GameClient";

export default function RoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  return <GameClient roomId={params.roomId} />;
}
