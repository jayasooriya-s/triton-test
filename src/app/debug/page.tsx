export default function DebugPage() {
  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>Debug Page</h1>
      <p>If you can see this, the server is working!</p>
      <p>Check the health endpoint: <a href="/api/health">/api/health</a></p>
    </div>
  );
}
