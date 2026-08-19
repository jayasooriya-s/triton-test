import TritonPlayer from "./components/TritonPlayer";

export default function Home() {
  return (
    <div className="app-container">
      {/* Decorative Orbs for background glowing aesthetics */}
      <div className="glow-orb-1"></div>
      <div className="glow-orb-2"></div>

      <header>
        <h1>TRITON DIGITAL SDK TESTBENCH</h1>
        <p>Interactive diagnostics and stream player for the Triton Web Player SDK</p>
      </header>

      <main className="main-content">
        {/* Left Side: Interactive Player UI */}
        <TritonPlayer />

        {/* Right Side: Developer Diagnostics Guide */}
        <div className="info-card">
          <h3>SDK Diagnostic Guide</h3>

          <div className="info-section">
            <h4>1. Testing the Triton SDK</h4>
            <p>
              Triton Player Web SDK (v2.9) operates by fetching a live stream XML configuration from <code>provisioning.streamtheworld.com</code> before playing audio. 
            </p>
            <p>
              Use the inline <strong>Manual Station/Mount Parameter Entry</strong> input field to dynamically test different stream callsigns:
            </p>
            <ul>
              <li><strong>WAMCFM</strong> (Station) — 🟢 Working public FM stream</li>
              <li><strong>TRITONRADIOMUSIC</strong> (Station) — 🟢 Working Triton global music sample</li>
              <li><strong>143875</strong> (Station) — 🔴 Returns 404 (Not Found)</li>
            </ul>
          </div>

          <div className="info-section">
            <h4>2. Troubleshooting 404 Not Found</h4>
            <p>
              If a station code (like <code>143875</code> for Big Radio Online) yields a 404 response from the StreamTheWorld provisioning API, the station is either deactivated, secure/tokenized, or has migrated off Triton's public servers.
            </p>
            <p>
              In such cases, the Triton SDK cannot resolve the server endpoints and will throw a <strong>moduleError</strong> or <strong>configurationError</strong>.
            </p>
          </div>

          <div className="info-section">
            <h4>3. Playing 92.7 BIG FM India</h4>
            <p>
              Since BIG FM India streams are no longer publicly routeable on Triton, we have pre-configured the <strong>Direct Audio Fallback</strong> tab to stream their active, direct audio server (hosted on ZenoFM). Toggle this tab to stream the live broadcast instantly.
            </p>
          </div>
        </div>
      </main>

      <footer>
        <p>
          Powered by Triton Player Web SDK v2.9. Designed for{" "}
          <a
            href="https://www.tritondigital.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Triton Digital Live Streaming
          </a>
        </p>
      </footer>
    </div>
  );
}

