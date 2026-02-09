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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                        style={{
                            position: "relative",
                            width: "min(720px, 92vw)"
                        }}
                    >
                        <img
                            src="/assets/ui/game-list.png"
                            alt="Mini Games"
                            style={{
                                width: "100%",
                                height: "auto",
                                display: "block"
                            }}
                        />
                        {/* Train Game hotspot (first card) */}
                        <Link
                            href="/game/train"
                            aria-label="Train Game"
                            style={{
                                position: "absolute",
                                left: "10%",
                                top: "26%",
                                width: "80%",
                                height: "12.5%",
                                borderRadius: 24,
                                display: "block"
                            }}
                        />
                        {/* Tower hotspot (last card) */}
                        <Link
                            href="/game/tower"
                            aria-label="Tower"
                            style={{
                                position: "absolute",
                                left: "10%",
                                top: "80%",
                                width: "80%",
                                height: "12.5%",
                                borderRadius: 24,
                                display: "block"
                            }}
                        />
                    </div>
                </div>
            </main>
        </>
    );
}
