import type { SensitiveMode } from "@/lib/sensitive";
import SmartImage from "@/components/media/SmartImage";

export default function SensitiveThumb({
  src,
  alt,
  isSensitive,
  mode,
}: {
  src: string | null;
  alt: string;
  isSensitive: boolean;
  mode: SensitiveMode;
}) {
  const blurred = isSensitive && mode === "BLUR";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f3f3f3",
          overflow: "hidden",
        }}
      >
        {src ? (
          <SmartImage
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            style={{
              objectFit: "cover",
              filter: blurred ? "blur(14px) brightness(0.75)" : undefined,
              transform: blurred ? "scale(1.05)" : undefined,
            }}
          />
        ) : (
          <div className="muted small" style={{ padding: 10 }}>
            No thumbnail
          </div>
        )}
      </div>

      {isSensitive ? (
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.92)",
            fontSize: 12,
            fontWeight: 800,
          }}
          title="Sensitive content"
        >
          ⚠ Sensitive
          <span className="muted" style={{ fontWeight: 600 }}>
            {mode === "SHOW" ? "" : mode.toLowerCase()}
          </span>
        </div>
      ) : null}
    </div>
  );
}
