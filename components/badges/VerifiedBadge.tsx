export default function VerifiedBadge({
  tier,
  className,
}: {
  tier: "PREMIUM" | "PREMIUM_PLUS" | "NONE";
  className?: string;
}) {
  if (tier === "NONE") return null;

  const label = tier === "PREMIUM_PLUS" ? "Premium+" : "Premium";

  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
        (className ?? "")
      }
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        className="opacity-90"
      >
        <path
          fill="currentColor"
          d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm4.293 7.293-5.25 5.25a1 1 0 0 1-1.414 0l-2.25-2.25a1 1 0 1 1 1.414-1.414l1.543 1.543 4.543-4.543a1 1 0 1 1 1.414 1.414Z"
        />
      </svg>
      {label}
    </span>
  );
}
