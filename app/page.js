import Link from "next/link";

const tools = [
  { title: "Trim Video", description: "Cut a video down to the part you need.", href: "/trim-video" },
  {
    title: "Instagram Video Downloader",
    description: "Save Instagram videos from a link.",
    href: "/instagram-downloader",
  },
  { title: "Image Conversion", description: "Convert images between PNG, JPG and WebP." },
  {
    title: "Instagram Account Videos",
    description: "List every video from an Instagram account, with captions.",
    href: "/instagram-account-videos",
  },
];

export default function Home() {
  return (
    <main>
      <h1>Useful Tools</h1>
      <div className="cards">
        {tools.map((tool) => {
          const content = (
            <>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
            </>
          );
          return tool.href ? (
            <Link key={tool.title} href={tool.href} className="card">
              {content}
            </Link>
          ) : (
            <div key={tool.title} className="card">
              {content}
            </div>
          );
        })}
      </div>
    </main>
  );
}
