export default function AdSlot({ html }: { html: string }) {
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="small muted" style={{ marginBottom: 6 }}>Sponsored</div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
