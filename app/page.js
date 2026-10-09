const tools = [
  { title: "Trim Video", description: "Cut a video down to the part you need." },
  { title: "Instagram Video Downloader", description: "Save Instagram videos from a link." },
  { title: "Image Conversion", description: "Convert images between PNG, JPG and WebP." },
];

export default function Home() {
  return (
    <main>
      <h1>Hello, World</h1>
      <div className="cards">
        {tools.map((tool) => (
          <div key={tool.title} className="card">
            <h2>{tool.title}</h2>
            <p>{tool.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
