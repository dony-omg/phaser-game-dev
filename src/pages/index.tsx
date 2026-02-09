import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
    return (
        <>
            <Head>
                <title>Game Hub</title>
                <meta name="description" content="Chọn game để bắt đầu." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.png" />
            </Head>
            <main className={`${styles.main} ${inter.className}`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                    <h1 style={{ fontSize: 32, margin: 0 }}>Chọn game</h1>
                    <Link href="/game/tower">Tower</Link>
                    <Link href="/game/train">Train Game</Link>
                </div>
            </main>
        </>
    );
}
