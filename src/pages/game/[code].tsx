import { useRouter } from "next/router";
import GamePage from "@/components/GamePage";

export default function GameByCode() {
    const router = useRouter();
    const rawCode = router.query.code;
    const gameCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

    return <GamePage gameCode={gameCode} />;
}
