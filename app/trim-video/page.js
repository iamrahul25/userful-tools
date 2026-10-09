import Link from "next/link";
import VideoTrimmer from "./VideoTrimmer";
import styles from "./trim.module.css";

export const metadata = {
  title: "Trim Video",
  description: "Trim a video right in your browser.",
};

export default function TrimVideoPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← All tools
      </Link>
      <h1 className={styles.title}>Trim Video</h1>
      <p className={styles.subtitle}>
        Your video is processed in your browser and never leaves your computer.
      </p>
      <VideoTrimmer />
    </main>
  );
}
