export async function jsonRpc<T = any>(url: string, method: string, params: any[] = []): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc_http_${res.status}`);
  const json = await res.json().catch(() => null);
  if (!json) throw new Error("rpc_invalid_json");
  if (json.error) throw new Error(`rpc_error_${json.error?.code || ""}_${json.error?.message || ""}`);
  return json.result as T;
}

export function hexToBigInt(hex: string): bigint {
  if (!hex) return 0n;
  return BigInt(hex.startsWith("0x") ? hex : `0x${hex}`);
}

export function pad32(hexNo0x: string): string {
  return hexNo0x.padStart(64, "0");
}

export function topicToAddress(topic: string): string {
  const t = topic.startsWith("0x") ? topic.slice(2) : topic;
  return "0x" + t.slice(24);
}
