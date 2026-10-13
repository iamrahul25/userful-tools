import Link from "next/link";
import ImageSplitter from "./ImageSplitter";
import styles from "./split.module.css";

export const metadata = {
  title: "Split Image",
  description: "Cut an image into an equal grid and download every piece.",
};

export default function SplitImagePage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>
        ← All tools
      </Link>
      <h1 className={styles.title}>Split Image</h1>
      <p className={styles.subtitle}>
        Choose a rows:columns grid, such as 2:4. That draws 1 horizontal line and 3 vertical
        lines, then cuts the image into 8 equal pieces and downloads them together. PNG
        transparency is kept.
      </p>
      <ImageSplitter />
    </main>
  );
}
