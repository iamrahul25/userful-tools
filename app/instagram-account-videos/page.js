import Link from "next/link";
import InstagramAccountVideos from "./InstagramAccountVideos";
import styles from "../instagram-downloader/instagram.module.css";

export const metadata = {
  title: "Instagram Account Videos",
  description: "List the videos posted by a public Instagram account, with their captions.",
};

export default function InstagramAccountVideosPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← All tools
      </Link>
      <h1 className={styles.title}>Instagram Account Videos</h1>
      <p className={styles.subtitle}>
        Enter the username of a public Instagram account to see its videos and captions.
      </p>
      <InstagramAccountVideos />
    </main>
  );
}
