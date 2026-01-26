const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

export function extractCandidateAddresses(payload: any): { solana: string[]; evm: string[] } {
  const sol = new Set<string>();
  const evm = new Set<string>();

  function visit(v: any) {
    if (!v) return;
    if (typeof v === "string") {
      const s = v.trim();
      if (SOL_RE.test(s)) sol.add(s);
      if (EVM_RE.test(s)) evm.add(s.toLowerCase());
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x);
      return;
    }
    if (typeof v === "object") {
      for (const k of Object.keys(v)) {
        visit((v as any)[k]);
      }
    }
  }

  visit(payload);
  return { solana: [...sol].slice(0, 50), evm: [...evm].slice(0, 50) };
}
