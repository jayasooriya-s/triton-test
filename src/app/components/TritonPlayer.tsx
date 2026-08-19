"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";

// Type definitions for Triton SDK global objects
declare global {
  interface Window {
    TDSdk: any;
  }
}

interface StationInfo {
  documentId: string;
  stationName: string;
  stationCode: string;
  isDefault: boolean;
  stationLang: string;
  sortOrder: number;
}

const STATION_DATA: StationInfo = {
  documentId: "akg0u0rrc0tuxsu2nn7li3mc",
  stationName: "Big Radio Online-Hindi",
  stationCode: "143875",
   //stationCode: "TRITONRADIOMUSIC",
  isDefault: true,
  stationLang: "hi-IN",
  sortOrder: 0,
};

export default function TritonPlayer() {
  // Sdk and Player states
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playbackState, setPlaybackState] = useState<
    "idle" | "connecting" | "buffering" | "playing" | "stopped" | "error"
  >("idle");
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playerMode, setPlayerMode] = useState<"triton" | "fallback">("triton");

  // Track / Metadata state
  const [trackInfo, setTrackInfo] = useState<{
    title: string;
    artist: string;
    album?: string;
    imageUrl?: string;
  } | null>(null);

  // Playback configuration for Triton SDK
  const [playParamType, setPlayParamType] = useState<"station" | "mount">("station");
  const [playParamValue, setPlayParamValue] = useState(STATION_DATA.stationCode);
  const [servicesRegion, setServicesRegion] = useState("");

  // Playback configuration for Fallback Audio player
  const [fallbackUrl, setFallbackUrl] = useState(
    "https://stream.zeno.fm/r2gn1pgm4qruv"
  );

  // Debug Console states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [logs, setLogs] = useState<{ time: string; text: string; type: "info" | "error" | "system" }[]>([]);

  // API XML inspection states (for developer debugging)
  const [xmlResponse, setXmlResponse] = useState<string>("");
  const [parsedInfo, setParsedInfo] = useState<{
    statusCode: string;
    statusMsg: string;
    mounts: { name: string; type: string; format: string }[];
  } | null>(null);
  const [isFetchingXml, setIsFetchingXml] = useState(false);
  const [xmlError, setXmlError] = useState<string | null>(null);
  const [showRawXml, setShowRawXml] = useState(false);

  // Refs
  const playerRef = useRef<any>(null);
  const audioFallbackRef = useRef<HTMLAudioElement | null>(null);

  // Add logs to local console
  const addLog = (text: string, type: "info" | "error" | "system" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, text, type }, ...prev].slice(0, 60));
  };

  // Inspect the raw Triton XML provisioning payload
  const inspectProvisioning = async (type: string, value: string) => {
    if (!value) return;
    setIsFetchingXml(true);
    setXmlError(null);
    setXmlResponse("");
    setParsedInfo(null);
    addLog(`Querying provisioning API for ${type}: "${value}"...`, "system");

    try {
      const res = await fetch(`/api/provisioning?type=${type}&value=${encodeURIComponent(value)}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }
      const xml = await res.text();
      setXmlResponse(xml);

      // Parse XML in client browser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "application/xml");
      
      const statusCode = xmlDoc.querySelector("status-code")?.textContent || "UNKNOWN";
      const statusMsg = xmlDoc.querySelector("status-message")?.textContent || "No Message";
      
      const mountNodes = xmlDoc.querySelectorAll("mountpoint");
      const mounts: { name: string; type: string; format: string }[] = [];
      
      mountNodes.forEach((node) => {
        const mountName = node.querySelector("mount")?.textContent || "";
        const format = node.querySelector("format")?.textContent || "";
        if (mountName) {
          mounts.push({
            name: mountName,
            type: node.querySelector("mountpoint mount")?.getAttribute("type") || "audio",
            format: format
          });
        }
      });

      setParsedInfo({
        statusCode,
        statusMsg,
        mounts
      });

      if (statusCode === "200" || statusCode === "OK") {
        addLog(`API Response: 200 OK. Resolves to ${mounts.length} mountpoint(s).`);
      } else {
        addLog(`API Response: Error ${statusCode} - ${statusMsg}`, "error");
      }
    } catch (err: any) {
      setXmlError(err.message);
      addLog(`API Inspection request failed: ${err.message}`, "error");
    } finally {
      setIsFetchingXml(false);
    }
  };

  useEffect(() => {
    addLog("Component mounted. Ready to load Triton SDK.", "system");
  }, []);

  // Sync volume with players when changed
  useEffect(() => {
    if (playerMode === "triton" && playerRef.current) {
      const vol = isMuted ? 0 : volume;
      // Triton SDK Volume sets from 0 to 1
      playerRef.current.setVolume(vol);
      addLog(`Triton player volume set to: ${vol}`);
    } else if (playerMode === "fallback" && audioFallbackRef.current) {
      audioFallbackRef.current.volume = isMuted ? 0 : volume;
      addLog(`Fallback audio volume set to: ${isMuted ? 0 : volume}`);
    }
  }, [volume, isMuted, playerMode]);

  // Handle SDK Loading Completed
  const handleSdkLoad = () => {
    addLog("Triton SDK Script loaded (td-sdk.min.js)", "system");
    setIsSdkLoaded(true);
    initializeTritonPlayer();
  };

  const handleSdkLoadError = () => {
    addLog("Failed to load Triton SDK Script. Please check your network connection.", "error");
    setPlaybackState("error");
  };

  // Initialize Triton Player using window.TDSdk
  const initializeTritonPlayer = () => {
    if (!window.TDSdk) {
      addLog("TDSdk constructor not found on window object", "error");
      return;
    }

    try {
      addLog("Initializing TDSdk instance...", "system");

      const tdPlayerConfig: any = {
        coreModules: [
          {
            id: "MediaPlayer",
            playerId: "td_container", // Div container
          },
        ],
        playerReady: () => {
          addLog("Triton playerReady event triggered. Player is active.", "system");
          setIsPlayerReady(true);
        },
        configurationError: (event: any) => {
          addLog(`Configuration Error: ${event?.data?.error?.message || "Unknown error"}`, "error");
          setPlaybackState("error");
        },
        moduleError: (event: any) => {
          addLog(`Module Error: ${event?.data?.error?.message || "Unknown error"}`, "error");
          setPlaybackState("error");
        },
        adBlockerDetected: () => {
          addLog("AdBlocker detected. Some features or ads may be blocked.", "info");
        },
      };

      // Set services region if specified
      if (servicesRegion) {
        tdPlayerConfig.playerServicesRegion = servicesRegion;
        addLog(`Player services region set to: ${servicesRegion}`, "system");
      }

      // Initialize
      const playerInstance = new window.TDSdk(tdPlayerConfig);
      playerRef.current = playerInstance;

      // Event Listeners
      playerInstance.addEventListener("stream-start", (event: any) => {
        addLog(`Stream start event: ${JSON.stringify(event?.data || {})}`);
        setPlaybackState("playing");
      });

      playerInstance.addEventListener("stream-status", (event: any) => {
        const code = event?.data?.code || "UNKNOWN";
        const statusMsg = event?.data?.status || "";
        addLog(`Stream status: [${code}] ${statusMsg}`);

        // Update local state based on status code
        if (code === "LIVE_PLAYING") {
          setPlaybackState("playing");
        } else if (code === "LIVE_CONNECTING") {
          setPlaybackState("connecting");
        } else if (code === "LIVE_BUFFERING") {
          setPlaybackState("buffering");
        } else if (code === "LIVE_STOPPED" || code === "LIVE_PAUSED") {
          setPlaybackState("stopped");
        } else if (code.includes("FAILED") || code.includes("ERROR")) {
          setPlaybackState("error");
          addLog(`Playback failure: ${code}`, "error");
        }
      });

      playerInstance.addEventListener("track-cue-point", (event: any) => {
        const cuePoint = event?.data?.cuePoint;
        if (cuePoint) {
          const title = cuePoint.cueTitle || "Unknown Track";
          const artist = cuePoint.artistName || "Unknown Artist";
          const album = cuePoint.albumName || "";
          const imageUrl = cuePoint.cueImageURL || 
                           cuePoint.parameters?.song_image_url || 
                           cuePoint.parameters?.TRACK_IMAGE_URL || 
                           cuePoint.parameters?.cueImageURL || "";
          addLog(`Now Playing Cue: ${artist} - ${title} ${imageUrl ? "[Has Image]" : ""}`);
          setTrackInfo({ title, artist, album, imageUrl });
        }
      });

      playerInstance.addEventListener("ad-playback-start", (event: any) => {
        addLog("Commercial/Ad playback started");
        setTrackInfo({ title: "Advertisement", artist: "Triton Digital Ads" });
      });

      playerInstance.addEventListener("ad-playback-complete", () => {
        addLog("Ad playback completed. Returning to stream.");
        setTrackInfo(null);
      });
    } catch (err: any) {
      addLog(`Initialization Exception: ${err.message}`, "error");
      console.error(err);
    }
  };

  // Play Action
  const handlePlay = () => {
    if (playerMode === "triton") {
      if (!isPlayerReady || !playerRef.current) {
        addLog("Triton player not ready yet.", "error");
        return;
      }

      try {
        const playParams: any = {};
        if (playParamType === "station") {
          playParams.station = playParamValue;
        } else {
          playParams.mount = playParamValue;
        }

        addLog(`Triggering TDSdk play with parameters: ${JSON.stringify(playParams)}`);
        setPlaybackState("connecting");
        playerRef.current.play(playParams);
        
        // Auto-fetch API provisioning XML for real-time debugging
        inspectProvisioning(playParamType, playParamValue);
      } catch (err: any) {
        addLog(`Play failed: ${err.message}`, "error");
        setPlaybackState("error");
      }
    } else {
      // Fallback HTML5 Audio Player
      if (audioFallbackRef.current) {
        try {
          addLog(`Playing Fallback URL: ${fallbackUrl}`);
          setPlaybackState("connecting");
          audioFallbackRef.current.src = fallbackUrl;
          audioFallbackRef.current.load();
          
          const playPromise = audioFallbackRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                addLog("Fallback audio playback started");
                setPlaybackState("playing");
                setTrackInfo({
                  title: "Live Stream Stream",
                  artist: playParamValue || STATION_DATA.stationName,
                });
              })
              .catch((error) => {
                addLog(`Fallback audio play failed: ${error.message}`, "error");
                setPlaybackState("error");
              });
          }
        } catch (err: any) {
          addLog(`Fallback audio error: ${err.message}`, "error");
          setPlaybackState("error");
        }
      }
    }
  };

  // Pause Action
  const handlePause = () => {
    if (playerMode === "triton") {
      if (playerRef.current) {
        try {
          addLog("Calling TDSdk stop()");
          playerRef.current.stop();
          setPlaybackState("stopped");
        } catch (err: any) {
          addLog(`Pause/Stop failed: ${err.message}`, "error");
        }
      }
    } else {
      if (audioFallbackRef.current) {
        addLog("Pausing fallback player");
        audioFallbackRef.current.pause();
        setPlaybackState("stopped");
      }
    }
  };

  // Toggle Mute Action
  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // Switch between Triton and Fallback Player Mode
  const handleModeChange = (mode: "triton" | "fallback") => {
    handlePause(); // stop currently running audio
    setPlayerMode(mode);
    setTrackInfo(null);
    setPlaybackState("idle");
    addLog(`Switched player mode to: ${mode.toUpperCase()}`, "system");
  };

  // Clear logs action
  const clearLogs = () => {
    setLogs([]);
    addLog("Logs cleared.", "system");
  };

  // Trigger custom debug play configuration
  const handleConfigPlay = () => {
    handlePause();
    setTimeout(() => {
      handlePlay();
    }, 200);
  };

  // Dynamically resolve station metadata for the display panel based on parameter inputs
  const getActiveStationMetadata = () => {
    if (playerMode === "fallback") {
      return {
        name: STATION_DATA.stationName,
        code: STATION_DATA.stationCode,
        lang: STATION_DATA.stationLang,
        id: STATION_DATA.documentId,
      };
    }

    const valueLower = playParamValue.trim().toLowerCase();
    if (!valueLower || valueLower === "143875" || valueLower === "big radio online-hindi") {
      return {
        name: STATION_DATA.stationName,
        code: STATION_DATA.stationCode,
        lang: STATION_DATA.stationLang,
        id: STATION_DATA.documentId,
      };
    } else if (valueLower === "wamcfm") {
      return {
        name: "WAMC Northeast Public Radio",
        code: "WAMCFM",
        lang: "en-US",
        id: "wamc_npr_pub_12345",
      };
    } else if (valueLower === "tritonradiomusic") {
      return {
        name: "Triton Global Sample Channel",
        code: "TRITONRADIOMUSIC",
        lang: "en-US",
        id: "triton_global_sample_99",
      };
    } else {
      // Dynamic fallback for custom streams typed by user
      return {
        name: `Custom Station: ${playParamValue}`,
        code: playParamValue,
        lang: "dynamic",
        id: `custom_${playParamValue.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      };
    }
  };

  const activeStation = getActiveStationMetadata();

  return (
    <div style={{ width: "100%", zIndex: 10 }}>
      {/* Hidden element where Triton SDK initializes audio stream context */}
      <div id="td_container" style={{ display: "none" }}></div>

      {/* Dynamic script loading for Triton SDK */}
      <Script
        src="https://sdk.listenlive.co/web/2.9/td-sdk.min.js"
        strategy="afterInteractive"
        onLoad={handleSdkLoad}
        onError={handleSdkLoadError}
      />

      <div className="player-card">
        {/* Header Tabs: Triton vs Fallback */}
        <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "1rem" }}>
          <button
            onClick={() => handleModeChange("triton")}
            className={`btn-action-secondary ${playerMode === "triton" ? "active" : ""}`}
            style={{
              flex: 1,
              borderColor: playerMode === "triton" ? "var(--accent-primary)" : "var(--glass-border)",
              color: playerMode === "triton" ? "var(--text-primary)" : "var(--text-secondary)",
              background: playerMode === "triton" ? "rgba(139, 92, 246, 0.1)" : "rgba(255,255,255,0.02)",
            }}
          >
            Triton Player SDK
          </button>
          <button
            onClick={() => handleModeChange("fallback")}
            className={`btn-action-secondary ${playerMode === "fallback" ? "active" : ""}`}
            style={{
              flex: 1,
              borderColor: playerMode === "fallback" ? "var(--accent-secondary)" : "var(--glass-border)",
              color: playerMode === "fallback" ? "var(--text-primary)" : "var(--text-secondary)",
              background: playerMode === "fallback" ? "rgba(236, 72, 153, 0.1)" : "rgba(255,255,255,0.02)",
            }}
          >
            Direct Audio Fallback
          </button>
        </div>

        {/* Station details */}
        <div className="station-info">
          <div className={`logo-container ${playbackState === "playing" ? "playing" : ""}`}>
            <div className="logo-inner">
              {trackInfo?.imageUrl ? (
                <img 
                  src={trackInfo.imageUrl} 
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "calc(1.5rem - 2px)" }} 
                  alt="Album Art" 
                  onError={(e) => {
                    // Fail gracefully and hide broken image
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              {(!trackInfo?.imageUrl) && (
                playbackState === "playing" ? (
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--accent-primary)">
                    <path d="M12 3v18M17 7v10M7 9v6M22 10v4M2 11v2" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--accent-primary)" />
                        <stop offset="100%" stopColor="var(--accent-secondary)" />
                      </linearGradient>
                    </defs>
                  </svg>
                ) : (
                  <span style={{
                    background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    📻
                  </span>
                )
              )}
            </div>
          </div>

          <div className="meta-content">
            <span className="badge">
              {playerMode === "triton" ? "Triton Web SDK 2.9" : "HTML5 Streaming"}
            </span>
            <h2 className="station-title">{activeStation.name}</h2>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <span>Code: <strong>{activeStation.code}</strong></span>
              <span>Lang: <strong>{activeStation.lang}</strong></span>
              <span>ID: <strong>{activeStation.id.slice(0, 8)}...</strong></span>
            </div>

            {/* Cue Metadata Details */}
            {trackInfo ? (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(0,0,0,0.15)", borderRadius: "0.75rem", borderLeft: "3px solid var(--accent-secondary)" }}>
                <div className="track-title">{trackInfo.title}</div>
                <div className="track-artist">{trackInfo.artist}</div>
                {trackInfo.album && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>Album: {trackInfo.album}</div>}
              </div>
            ) : (
              <div style={{ marginTop: "1.25rem", color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
                {playbackState === "playing" ? "Streaming Live Audio..." : "Click play to start broadcast"}
              </div>
            )}
          </div>
        </div>

        {/* Play Parameter Manual Input (added for user test requirement) */}
        {playerMode === "triton" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", background: "rgba(0,0,0,0.12)", padding: "1rem", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.03)" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Manual Station/Mount Parameter Entry
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                className="debug-input"
                style={{ width: "30%", minWidth: "80px" }}
                value={playParamType}
                onChange={(e) => setPlayParamType(e.target.value as "station" | "mount")}
                title="Select play type"
              >
                <option value="station">Station</option>
                <option value="mount">Mount</option>
              </select>
              <input
                type="text"
                className="debug-input"
                style={{ flex: 1 }}
                value={playParamValue}
                onChange={(e) => setPlayParamValue(e.target.value)}
                placeholder="e.g. WAMCFM, TRITONRADIOMUSIC"
                title="Enter code here"
              />
              <button 
                className="btn-action" 
                onClick={() => inspectProvisioning(playParamType, playParamValue)}
                style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem" }}
                title="Inspect API XML Response"
              >
                Inspect 🔍
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", alignSelf: "center", marginRight: "0.25rem" }}>
                Quick Presets:
              </span>
              <button
                className="btn-action-secondary"
                onClick={() => {
                  setPlayParamType("station");
                  setPlayParamValue("WAMCFM");
                  addLog("Loaded WAMCFM preset");
                }}
                style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
              >
                WAMCFM
              </button>
              <button
                className="btn-action-secondary"
                onClick={() => {
                  setPlayParamType("station");
                  setPlayParamValue("TRITONRADIOMUSIC");
                  addLog("Loaded TRITONRADIOMUSIC preset");
                }}
                style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
              >
                Triton Sample
              </button>
              <button
                className="btn-action-secondary"
                onClick={() => {
                  setPlayParamType("station");
                  setPlayParamValue("143875");
                  addLog("Loaded Big Radio (143875) preset");
                }}
                style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
              >
                Big Radio (404)
              </button>
            </div>

            {/* API Response Display for Developer Debugging */}
            {(isFetchingXml || xmlResponse || xmlError) && (
              <div 
                style={{ 
                  marginTop: "0.75rem", 
                  padding: "0.75rem 1rem", 
                  borderRadius: "0.75rem", 
                  background: "rgba(0, 0, 0, 0.25)", 
                  border: `1px solid ${
                    xmlError ? "var(--error)" : 
                    parsedInfo?.statusCode === "200" || parsedInfo?.statusCode === "OK" ? "var(--success)" : 
                    parsedInfo?.statusCode && parsedInfo?.statusCode !== "UNKNOWN" ? "var(--error)" :
                    "rgba(255,255,255,0.06)"
                  }`,
                  fontSize: "0.8rem",
                  transition: "all 0.3s ease"
                }}
              >
                {isFetchingXml ? (
                  <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ animation: "spin 1.5s linear infinite", display: "inline-block" }}>⏳</span> Querying provisioning XML configuration...
                  </div>
                ) : xmlError ? (
                  <div style={{ color: "var(--error)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <strong style={{ fontSize: "0.85rem" }}>API Fetch Failure</strong>
                    <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>{xmlError}</span>
                  </div>
                ) : parsedInfo ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>
                        Provisioning API Status:{" "}
                        <span style={{ color: parsedInfo.statusCode === "200" || parsedInfo.statusCode === "OK" ? "var(--success)" : "var(--error)" }}>
                          {parsedInfo.statusCode} {parsedInfo.statusMsg}
                        </span>
                      </span>
                      <button
                        className="btn-action-secondary"
                        onClick={() => setShowRawXml(!showRawXml)}
                        style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", height: "auto", borderRadius: "0.35rem" }}
                      >
                        {showRawXml ? "Hide XML ✕" : "Show XML 🔍"}
                      </button>
                    </div>

                    {parsedInfo.mounts.length > 0 ? (
                      <div style={{ color: "var(--text-secondary)" }}>
                        <strong>Active Stream Mountpoints:</strong> <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(Click to select for testing)</span>
                        <ul style={{ paddingLeft: "0", listStyle: "none", marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {parsedInfo.mounts.map((m, idx) => (
                            <li key={idx}>
                              <button
                                onClick={() => {
                                  setPlayParamType("mount");
                                  setPlayParamValue(m.name);
                                  addLog(`Selected mount: "${m.name}" from API results`);
                                }}
                                style={{
                                  background: "rgba(255, 255, 255, 0.03)",
                                  border: "1px solid rgba(255, 255, 255, 0.08)",
                                  borderRadius: "0.5rem",
                                  padding: "0.35rem 0.6rem",
                                  color: "var(--accent-primary-hover)",
                                  fontFamily: "monospace",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  transition: "all 0.2s"
                                }}
                                className="btn-action-secondary"
                                title={`Select ${m.name}`}
                              >
                                <span>🔗 {m.name}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>({m.format})</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>
                        No playable mountpoints returned (Stream is geo-restricted or code is invalid).
                      </div>
                    )}

                    {showRawXml && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Raw XML Payload:</div>
                        <pre 
                          style={{ 
                            background: "rgba(0,0,0,0.65)", 
                            padding: "0.75rem", 
                            borderRadius: "0.5rem", 
                            overflowX: "auto", 
                            fontFamily: "monospace", 
                            fontSize: "0.7rem",
                            color: "#67e8f9", /* cyan */
                            maxHeight: "160px",
                            border: "1px solid rgba(255,255,255,0.03)"
                          }}
                        >
                          {xmlResponse}
                        </pre>
                      </div>
                    )}

                    {/* Non-Developer Friendly Error Explanation */}
                    {parsedInfo.statusCode === "404" && (
                      <div 
                        style={{ 
                          marginTop: "0.75rem", 
                          padding: "1rem", 
                          background: "rgba(239, 68, 68, 0.08)", 
                          border: "1px solid rgba(239, 68, 68, 0.15)", 
                          borderRadius: "0.75rem",
                          color: "var(--text-primary)"
                        }}
                      >
                        <h4 style={{ color: "#fca5a5", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                          ⚠️ Connection Issue: Code Not Recognized
                        </h4>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.45" }}>
                          Triton Digital's servers returned a <strong>404 Not Found</strong> error for the code <strong>"{playParamValue}"</strong>. This indicates the station code is incorrect, has expired, or is restricted. Please request the proper <strong>Triton Callsign / Mount Name</strong> from the BIG FM team.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Player controls */}
        <div className="player-controls">
          {/* Animated sound wave bars */}
          <div className={`equalizer ${playbackState === "playing" ? "playing" : ""}`}>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
            <div className="eq-bar"></div>
          </div>

          {/* Buttons and volume row */}
          <div className="control-row">
            <div className="action-buttons">
              {playbackState === "playing" || playbackState === "buffering" || playbackState === "connecting" ? (
                <button className="btn-play-pause" onClick={handlePause} aria-label="Pause button">
                  {playbackState === "playing" ? (
                    <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    /* Loading/Buffering loading circle spinner */
                    <svg viewBox="0 0 50 50" style={{ animation: "spin 1.5s linear infinite" }}>
                      <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" />
                      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </svg>
                  )}
                </button>
              ) : (
                <button className="btn-play-pause" onClick={handlePlay} aria-label="Play button">
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
              )}

              {/* Reset button */}
              <button
                className="btn-secondary"
                onClick={() => {
                  handlePause();
                  setTrackInfo(null);
                  if (playerMode === "triton") {
                    initializeTritonPlayer();
                  }
                  addLog("Player reset triggered.", "system");
                }}
                title="Reset Player"
                aria-label="Reset Player button"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
            </div>

            {/* Mute and Slider volume controls */}
            <div className="volume-control">
              <button className="btn-mute" onClick={handleToggleMute} aria-label="Mute toggle button">
                {isMuted || volume === 0 ? (
                  <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.03a8.28 8.28 0 0 0 3.63-1.82L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : volume < 0.4 ? (
                  <svg viewBox="0 0 24 24"><path d="M7 9v6h4l5 5V4l-5 5H7zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="volume-slider"
                title="Volume slider"
                aria-label="Volume slider"
              />
            </div>
          </div>

          {/* Status Bar */}
          <div className="status-indicator">
            <span className={`status-dot ${playbackState}`} />
            <span>
              {playbackState === "idle" && "Ready"}
              {playbackState === "connecting" && "Establishing connection..."}
              {playbackState === "buffering" && "Buffering audio stream..."}
              {playbackState === "playing" && `Now Streaming (Active)`}
              {playbackState === "stopped" && "Stopped"}
              {playbackState === "error" && "Playback Error (SDK Initialization/Geo-limit)"}
            </span>
          </div>
        </div>

        {/* Fallback Native Audio Element */}
        {playerMode === "fallback" && (
          <div className="fallback-player-card">
            <h4>Direct Stream Fallback (ZenoFM)</h4>
            <p>Uses the direct live stream URL for 92.7 BIG FM India. This bypasses Triton's 404 mount restriction and works out-of-the-box.</p>
            <div className="fallback-row">
              <input
                type="text"
                className="debug-input"
                value={fallbackUrl}
                onChange={(e) => setFallbackUrl(e.target.value)}
                placeholder="Direct Streaming URL"
                title="Direct Streaming URL input"
              />
            </div>
            <audio
              ref={audioFallbackRef}
              style={{ display: "none" }}
              onPlay={() => setPlaybackState("playing")}
              onPause={() => setPlaybackState("stopped")}
              onEnded={() => setPlaybackState("stopped")}
              onError={(e) => {
                const audio = e.currentTarget;
                addLog(`Fallback Audio error code: ${audio.error?.code}, message: ${audio.error?.message}`, "error");
                setPlaybackState("error");
              }}
            />
          </div>
        )}

        {/* Debug Console Panel Drawer Toggle */}
        <div className="debug-panel-toggle">
          <button
            className="btn-toggle-debug"
            onClick={() => setIsConfigOpen((prev) => !prev)}
          >
            {isConfigOpen ? "Hide Debug Console ✕" : "Show Debug Console ⚙"}
          </button>
        </div>

        {/* Debug Drawer Panel */}
        {isConfigOpen && (
          <div className="debug-drawer">
            <h3>Triton Player Configurer & Event Logger</h3>

            <div className="debug-grid">
              {/* SDK parameters column */}
              <div className="debug-column">
                <label>Playback Method Payload</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className={`btn-action-secondary ${playParamType === "station" ? "active" : ""}`}
                    onClick={() => {
                      setPlayParamType("station");
                      addLog("Set playback parameter to 'station'");
                    }}
                    style={{
                      flex: 1,
                      borderColor: playParamType === "station" ? "var(--accent-primary)" : "rgba(255,255,255,0.05)",
                      background: playParamType === "station" ? "rgba(139,92,246,0.15)" : "transparent",
                    }}
                  >
                    station
                  </button>
                  <button
                    className={`btn-action-secondary ${playParamType === "mount" ? "active" : ""}`}
                    onClick={() => {
                      setPlayParamType("mount");
                      addLog("Set playback parameter to 'mount'");
                    }}
                    style={{
                      flex: 1,
                      borderColor: playParamType === "mount" ? "var(--accent-primary)" : "rgba(255,255,255,0.05)",
                      background: playParamType === "mount" ? "rgba(139,92,246,0.15)" : "transparent",
                    }}
                  >
                    mount
                  </button>
                </div>

                <label style={{ marginTop: "0.5rem" }}>Parameter Value (e.g. Call Sign or ID)</label>
                <div className="debug-input-group">
                  <input
                    type="text"
                    className="debug-input"
                    value={playParamValue}
                    onChange={(e) => setPlayParamValue(e.target.value)}
                    placeholder="e.g. 143875 or TRITONRADIOMUSIC"
                    title="Play parameter value input"
                  />
                  <button className="btn-action" onClick={handleConfigPlay}>
                    Apply & Play
                  </button>
                </div>
              </div>

              {/* Regional connection column */}
              <div className="debug-column">
                <label>Player Services Region (Optional)</label>
                <div className="debug-input-group">
                  <select
                    className="debug-input"
                    value={servicesRegion}
                    onChange={(e) => {
                      setServicesRegion(e.target.value);
                      addLog(`Service Region set to: ${e.target.value || "Default (us)"}`);
                    }}
                    title="Select service region"
                  >
                    <option value="">Default (Auto / US)</option>
                    <option value="us">United States (us)</option>
                    <option value="eu">Europe (eu)</option>
                    <option value="asia">Asia (asia)</option>
                  </select>
                  <button
                    className="btn-action-secondary"
                    onClick={() => {
                      initializeTritonPlayer();
                    }}
                  >
                    Re-Init SDK
                  </button>
                </div>

                <label style={{ marginTop: "0.5rem" }}>Preset Radio Stream Codes</label>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  <button
                    className="btn-action-secondary"
                    onClick={() => {
                      setPlayParamType("station");
                      setPlayParamValue("143875");
                      addLog("Loaded preset: Station 143875");
                    }}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  >
                    Big Radio (143875)
                  </button>
                  <button
                    className="btn-action-secondary"
                    onClick={() => {
                      setPlayParamType("station");
                      setPlayParamValue("WAMCFM");
                      addLog("Loaded preset: Station WAMCFM");
                    }}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  >
                    WAMC FM Preset
                  </button>
                  <button
                    className="btn-action-secondary"
                    onClick={() => {
                      setPlayParamType("station");
                      setPlayParamValue("TRITONRADIOMUSIC");
                      addLog("Loaded preset: Station TRITONRADIOMUSIC");
                    }}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  >
                    Triton Sample
                  </button>
                </div>
              </div>
            </div>

            {/* Event logs box */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <label style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Live Event Logger</label>
              <button
                className="btn-action-secondary"
                onClick={clearLogs}
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                Clear Logs
              </button>
            </div>
            <div className="debug-logs-box">
              {logs.length === 0 ? (
                <div className="debug-log-line system">Console idle. Awaiting user gestures...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`debug-log-line ${log.type}`}>
                    <span style={{ color: "var(--text-muted)", marginRight: "0.5rem" }}>{log.time}</span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
