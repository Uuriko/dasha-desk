"use client";

import { FormEvent, useMemo, useState } from "react";

type Door = "use" | "provide";
type NetworkStatus = {
  providers_online: number;
  models_available: string[];
  jobs_queued?: number;
};

const COORDINATOR = "https://lobby.getdasha.com/compute/api";
const LIVE = "https://www.getdasha.com/compute";

const CHIPS = {
  "M1 / M2": { tps: 8, watts: 24 },
  "M1 Pro / M2 Pro": { tps: 14, watts: 34 },
  "M1 Max / M2 Max": { tps: 24, watts: 52 },
  "M3 Pro / M4 Pro": { tps: 20, watts: 38 },
  "M3 Max / M4 Max": { tps: 38, watts: 68 },
  "M2 Ultra / M3 Ultra": { tps: 58, watts: 110 },
};

const RAM_OPTIONS = [8, 16, 24, 32, 48, 64, 96, 128, 192];

const MODELS = [
  { id: "qwen3-8b", local: "qwen3:8b", label: "Qwen 3 8B", size: "5.2 GB", minRam: 8 },
  { id: "gemma3-12b", local: "gemma3:12b", label: "Gemma 3 12B", size: "8.1 GB", minRam: 16 },
  { id: "gpt-oss-20b", local: "gpt-oss:20b", label: "GPT-OSS 20B", size: "14 GB", minRam: 16 },
  { id: "qwen3-30b-a3b", local: "qwen3:30b", label: "Qwen 3 30B A3B", size: "19 GB", minRam: 24 },
  { id: "gemma3-27b", local: "gemma3:27b", label: "Gemma 3 27B", size: "17 GB", minRam: 24 },
  { id: "gpt-oss-120b", local: "gpt-oss:120b", label: "GPT-OSS 120B", size: "65 GB", minRam: 96 },
];

function keyFileSetup(modelId: string, local: string) {
  return `umask 077
cat > .dasha-provider-key <<'KEY'
paste-the-one-time-token
KEY
chmod 0600 .dasha-provider-key
DASHA_COORDINATOR_URL=${COORDINATOR} \\
DASHA_PROVIDER_ID=your-provider-id \\
DASHA_MODEL_MAP=${modelId}=${local} \\
./install.sh`;
}

export default function Home() {
  const [door, setDoor] = useState<Door | null>(null);
  const [opened, setOpened] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chip, setChip] = useState<keyof typeof CHIPS>("M3 Max / M4 Max");
  const [ram, setRam] = useState(64);
  const [network, setNetwork] = useState<NetworkStatus | null>(null);

  const recommended = useMemo(
    () => MODELS.filter((model) => ram >= model.minRam).at(-1) ?? MODELS[0],
    [ram],
  );
  const setup = useMemo(() => keyFileSetup(recommended.id, recommended.local), [recommended]);

  async function loadNetwork() {
    try {
      const response = await fetch(`${COORDINATOR}/network`, { cache: "no-store", credentials: "include" });
      if (!response.ok) return;
      const body = await response.json();
      if (typeof body.providers_online === "number") {
        setNetwork({
          providers_online: body.providers_online,
          models_available: Array.isArray(body.models_available) ? body.models_available : [],
          jobs_queued: typeof body.jobs_queued === "number" ? body.jobs_queued : undefined,
        });
      }
    } catch {
      // Stay unread. Never paint a checking chip.
    }
  }

  function openPanel() {
    setOpened(true);
    void loadNetwork();
  }

  async function runHosted(event: FormEvent) {
    event.preventDefault();
    const clean = prompt.trim();
    if (!clean || busy) return;
    setBusy(true);
    setAnswer("");
    try {
      const response = await fetch(`${COORDINATOR}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: clean }] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = String(data.error || data.message || "");
        setAnswer(/login/i.test(error) ? `Log in at ${LIVE}, then Run.` : error || "Hosted run failed.");
        return;
      }
      setAnswer(typeof data.answer === "string" ? data.answer : JSON.stringify(data));
      openPanel();
    } catch {
      setAnswer(`Could not reach hosted Workers AI from this snapshot. Run it on ${LIVE}.`);
    } finally {
      setBusy(false);
    }
  }

  async function copySetup() {
    try {
      await navigator.clipboard.writeText(setup);
      setCopied(true);
      openPanel();
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="shell hop-shell">
      <a className="skip" href="#workspace">Skip to product</a>

      <header className="topbar">
        <a className="brand" href="https://www.getdasha.com/" aria-label="$dasha home"><span>$dasha</span> compute</a>
        <a className="back-link" href="https://www.getdasha.com/">getdasha.com ↗</a>
      </header>

      <section id="workspace" className="hop" aria-live="polite">
        {door === null && (
          <div className="hop-step">
            <p className="kicker acid">Open alpha</p>
            <h1>Make the Macs do something.</h1>
            <p className="hop-lede">Hosted is Workers AI.</p>
            <div className="door-row">
              <button className="primary-button door" type="button" onClick={() => setDoor("use")}>Use</button>
              <button className="secondary-button door" type="button" onClick={() => setDoor("provide")}>Provide</button>
            </div>
          </div>
        )}

        {door === "use" && (
          <div className="hop-step">
            <button className="text-button hop-back" type="button" onClick={() => setDoor(null)}>Use or Provide</button>
            <p className="kicker acid">Use</p>
            <h2>One prompt.</h2>
            <form className="prompt-box hop-prompt" onSubmit={runHosted}>
              <label htmlFor="prompt">Prompt</label>
              <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={2000} placeholder="Ask." />
              <div>
                <span>Hosted is Workers AI. Do not send secrets.</span>
                <button className="primary-button" type="submit" disabled={busy || !prompt.trim()}>{busy ? "Running" : "Run"}</button>
              </div>
            </form>
            {answer && <pre className="hop-answer" aria-live="polite">{answer}</pre>}
          </div>
        )}

        {door === "provide" && (
          <div className="hop-step">
            <button className="text-button hop-back" type="button" onClick={() => setDoor(null)}>Use or Provide</button>
            <p className="kicker acid">Provide</p>
            <h2>Size this Mac.</h2>
            <div className="form-grid hop-size">
              <label>Chip
                <select value={chip} onChange={(event) => setChip(event.target.value as keyof typeof CHIPS)}>
                  {Object.keys(CHIPS).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>Unified memory
                <select value={ram} onChange={(event) => setRam(Number(event.target.value))}>
                  {RAM_OPTIONS.map((item) => <option key={item} value={item}>{item} GB{item === 192 ? "+" : ""}</option>)}
                </select>
              </label>
            </div>
            <p className="hop-lede">Recommended: {recommended.label}. Token in a 0600 file. Not argv.</p>
            <div className="install-code hop-setup">
              <button className="text-button" type="button" onClick={() => void copySetup()}>{copied ? "Copied" : "Copy setup"}</button>
              <pre><code>{setup}</code></pre>
            </div>
            <p className="fine-print">Register the Mac on {LIVE}. Coordinator {COORDINATOR}.</p>
          </div>
        )}

        {opened && (
          <section className="hop-panel" aria-label="Control panel">
            <article>
              <span>Night</span>
              <strong>Wake up to finished work.</strong>
              <a href={`${LIVE}#night`}>Schedule on getdasha.com</a>
            </article>
            <article>
              <span>Build</span>
              <strong>Change one base URL.</strong>
              <pre><code>{`curl ${COORDINATOR}/v1/chat/completions \\
  -H "Authorization: Bearer $DASHA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${recommended.id}","messages":[{"role":"user","content":"hello"}]}'`}</code></pre>
            </article>
            <article>
              <span>Status</span>
              <strong>{network ? `${network.providers_online} providers online` : "providers_online unread"}</strong>
              <p>{network ? `${network.models_available.length} models · ${network.jobs_queued ?? 0} queued` : "Fetched after first success. 0 is a real number."}</p>
            </article>
            <article>
              <span>Network</span>
              <strong>{COORDINATOR}</strong>
              <p>Community queue. Not hosted Workers AI.</p>
            </article>
          </section>
        )}
      </section>

      <footer><span>$dasha compute · hop-up</span><span>53ux…pump</span><span>hosted is Workers AI</span></footer>
    </main>
  );
}
