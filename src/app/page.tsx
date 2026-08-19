export default function Home() {
  return (
    <div style={{ padding: "40px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ color: "#0066cc" }}>✅ Deployment Successful!</h1>
      <p>The Next.js application is running correctly on Vercel.</p>
      <hr />
      <p>If you see this message, the root route is working.</p>
      <p>Check these endpoints:</p>
      <ul>
        <li><a href="/api/health">/api/health</a> - Health check endpoint</li>
        <li><a href="/debug">/debug</a> - Debug info page</li>
      </ul>
    </div>
  );
}

