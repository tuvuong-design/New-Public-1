export default function WatchLaterToggleForm({
  videoId,
  active,
  disabled,
}: {
  videoId: string;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <form action="/api/me/watch-later/toggle" method="post">
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="redirect" value={`/v/${videoId}`} />
      <button className="btn" type="submit" disabled={disabled}>
        {active ? "Remove Watch Later" : "Watch Later"}
      </button>
    </form>
  );
}
