import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const inter = Inter({ subsets: ["latin"] });
const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function GameByCode() {
    const router = useRouter();
    const rawCode = router.query.code;
    const gameCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

    return (
        <>
            <Head>
                <title>Đua Từ Vựng</title>
                <meta name="description" content="Game đua từ vựng làm bằng Phaser 3 và Next.js." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.png" />
            </Head>
            <main className={`${styles.main} ${inter.className}`}>
                <AppWithoutSSR gameCode={gameCode} />
            </main>
        </>
    );
}
