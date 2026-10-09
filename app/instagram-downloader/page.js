import Link from "next/link";
import InstagramDownloader from "./InstagramDownloader";
import styles from "./instagram.module.css";

export const metadata = {
  title: "Instagram Video Downloader",
  description: "Download videos and reels from public Instagram posts.",
};

export default function InstagramDownloaderPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← All tools
      </Link>
      <h1 className={styles.title}>Instagram Video Downloader</h1>
      <p className={styles.subtitle}>
        Paste a link to a public Instagram post or reel to save its video.
      </p>
      <InstagramDownloader />
    </main>
  );
}
