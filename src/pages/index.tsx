import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiMode, getApiMode, getDefaultApiMode, setApiMode } from "@/services/apiMode";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
    const showApiDebugPanel = process.env.NEXT_PUBLIC_SHOW_API_DEBUG === "1";
    const [apiMode, setApiModeState] = useState<ApiMode>(getDefaultApiMode());

    useEffect(() => {
        setApiModeState(getApiMode());
    }, []);

    const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "(chưa set)", []);

    const applyMode = (mode: ApiMode) => {
        setApiMode(mode);
        setApiModeState(mode);
    };

    return (
        <>
            <Head>
                <title>Game Hub</title>
                <meta name="description" content="Chọn game để bắt đầu." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.png" />
            </Head>
            <main className={`${styles.main} ${inter.className}`}>
                <div className={styles.hubWrap}>
                    {showApiDebugPanel ? (
                        <section className={styles.debugPanel}>
                            <div className={styles.debugTitle}>Debug Hub Mode</div>
                            <div className={styles.debugRow}>
                                <button
                                    type="button"
                                    onClick={() => applyMode("real")}
                                    className={`${styles.modeBtn} ${apiMode === "real" ? styles.activeReal : ""}`}
                                >
                                    REAL API
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyMode("mock")}
                                    className={`${styles.modeBtn} ${apiMode === "mock" ? styles.activeMock : ""}`}
                                >
                                    MOCK API
                                </button>
                            </div>
                            <div className={styles.debugMeta}>Current: <b>{apiMode.toUpperCase()}</b></div>
                            <div className={styles.debugMeta}>Base URL: {apiUrl}</div>
                        </section>
                    ) : null}

                    <div className={styles.mapWrap}>
                        <img
                            src="/assets/ui/game-list.png"
                            alt="Mini Games"
                            style={{
                                width: "100%",
                                height: "auto",
                                display: "block"
                            }}
                        />
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
