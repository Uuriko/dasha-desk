"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "use" | "provide" | "build" | "source";
type CodeLanguage = "python" | "javascript" | "curl";
type NetworkStatus = {
  phase: string;
  providers_online: number;
  models_available: string[];
  jobs_queued: number;
  inference_live: boolean;
  privacy_level: string;
  source_version?: string;
};

const NAV: { id: View; label: string; note: string }[] = [
  { id: "use", label: "Use", note: "request lab" },
  { id: "provide", label: "Provide", note: "size a Mac" },
  { id: "build", label: "Build", note: "API + status" },
  { id: "source", label: "Source", note: "download" },
];

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
  { id: "qwen3-8b", local: "qwen3:8b", label: "Qwen 3 8B", size: "5.2 GB", minRam: 8, use: "fast chat", href: "https://ollama.com/library/qwen3" },
  { id: "gemma3-12b", local: "gemma3:12b", label: "Gemma 3 12B", size: "8.1 GB", minRam: 16, use: "vision + chat", href: "https://ollama.com/library/gemma3" },
  { id: "gpt-oss-20b", local: "gpt-oss:20b", label: "GPT-OSS 20B", size: "14 GB", minRam: 16, use: "reasoning + tools", href: "https://ollama.com/library/gpt-oss" },
  { id: "qwen3-30b-a3b", local: "qwen3:30b", label: "Qwen 3 30B A3B", size: "19 GB", minRam: 24, use: "efficient reasoning", href: "https://ollama.com/library/qwen3" },
  { id: "gemma3-27b", local: "gemma3:27b", label: "Gemma 3 27B", size: "17 GB", minRam: 24, use: "large multimodal", href: "https://ollama.com/library/gemma3" },
  { id: "gpt-oss-120b", local: "gpt-oss:120b", label: "GPT-OSS 120B", size: "65 GB", minRam: 96, use: "large reasoning", href: "https://ollama.com/library/gpt-oss" },
];

const codeExamples: Record<CodeLanguage, string> = {
  python: `from openai import OpenAI

client = OpenAI(
    base_url="https://compute.getdasha.com/v1",
    api_key="dasha_alpha_...",
)

stream = client.chat.completions.create(
    model="qwen3-30b-a3b",
    messages=[{"role": "user", "content": "say something strange"}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")`,
  javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://compute.getdasha.com/v1",
  apiKey: "dasha_alpha_...",
});

const stream = await client.chat.completions.create({
  model: "qwen3-30b-a3b",
  messages: [{ role: "user", content: "say something strange" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`,
  curl: `curl https://compute.getdasha.com/v1/chat/completions \\
  -H "Authorization: Bearer dasha_alpha_..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"qwen3-30b-a3b","messages":[{"role":"user","content":"say something strange"}],"stream":true}'`,
};

const EMPTY_NETWORK: NetworkStatus = {
  phase: "checking",
  providers_online: 0,
  models_available: [],
  jobs_queued: 0,
  inference_live: false,
  privacy_level: "browser-demo-only",
};

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="mark" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("use");
  const [network, setNetwork] = useState<NetworkStatus>(EMPTY_NETWORK);
  const [networkError, setNetworkError] = useState(false);
  const [prompt, setPrompt] = useState("Explain why idle Macs are useful for local AI in two sentences.");
  const [stagedPrompt, setStagedPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("qwen3-30b-a3b");
  const [chip, setChip] = useState<keyof typeof CHIPS>("M3 Max / M4 Max");
  const [ram, setRam] = useState(64);
  const [hours, setHours] = useState(12);
  const [demand, setDemand] = useState(25);
  const [tokenRate, setTokenRate] = useState(1);
  const [electricityRate, setElectricityRate] = useState(0.28);
  const [language, setLanguage] = useState<CodeLanguage>("python");
  const [copied, setCopied] = useState<string | null>(null);
  const [gatewayResult, setGatewayResult] = useState("Not checked yet.");
  const [checkingGateway, setCheckingGateway] = useState(false);

  async function refreshNetwork() {
    try {
      const response = await fetch("/v1/network", { cache: "no-store" });
      if (!response.ok) throw new Error("status unavailable");
      setNetwork(await response.json());
      setNetworkError(false);
    } catch {
      setNetworkError(true);
      setNetwork({ ...EMPTY_NETWORK, phase: "offline" });
    }
  }

  useEffect(() => {
    const hash = window.location.hash.slice(1) as View;
    if (NAV.some((item) => item.id === hash)) setView(hash);
    void refreshNetwork();
  }, []);

  const compatibleModels = useMemo(() => MODELS.filter((model) => ram >= model.minRam), [ram]);
  const recommendedModel = compatibleModels.at(-1) ?? MODELS[0];

  const capacity = useMemo(() => {
    const profile = CHIPS[chip];
    const seconds = hours * 30 * 3600 * (demand / 100);
    const tokens = Math.round(profile.tps * seconds);
    const gross = (tokens / 1_000_000) * tokenRate;
    const power = (profile.watts / 1000) * hours * 30 * electricityRate;
    return {
      tokens,
      gross,
      power,
      net: gross - power,
    };
  }, [chip, hours, demand, tokenRate, electricityRate]);

  const requestPreview = useMemo(() => JSON.stringify({
    model: selectedModel,
    messages: [{ role: "user", content: stagedPrompt || prompt.trim() || "…" }],
    stream: true,
  }, null, 2), [prompt, selectedModel, stagedPrompt]);

  const providerCommand = `ollama pull ${recommendedModel.local}\nDASHA_MODEL_MAP=${recommendedModel.id}=${recommendedModel.local} python3 provider/agent.py --doctor\nDASHA_MODEL_MAP=${recommendedModel.id}=${recommendedModel.local} python3 provider/agent.py`;

  function selectView(next: View) {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  function stageRequest(event: FormEvent) {
    event.preventDefault();
    const clean = prompt.trim();
    if (!clean) return;
    setStagedPrompt(clean);
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("failed");
    }
  }

  async function checkGateway() {
    setCheckingGateway(true);
    try {
      const [modelsResponse, networkResponse] = await Promise.all([
        fetch("/v1/models", { cache: "no-store" }),
        fetch("/v1/network", { cache: "no-store" }),
      ]);
      const modelsBody = await modelsResponse.json();
      const networkBody = await networkResponse.json();
      setGatewayResult(JSON.stringify({ models: modelsBody.data?.length ?? 0, network: networkBody }, null, 2));
      setNetwork(networkBody);
    } catch {
      setGatewayResult(JSON.stringify({ error: "gateway status unavailable" }, null, 2));
    } finally {
      setCheckingGateway(false);
    }
  }

  return (
    <main className="shell">
      <a className="skip" href="#workspace">Skip to product</a>

      <header className="topbar">
        <a className="brand" href="https://www.getdasha.com/" aria-label="$dasha home"><span>$dasha</span> compute</a>
        <div className="top-status"><span className={network.inference_live ? "pulse live" : "pulse"} />{network.inference_live ? "network live" : "open alpha"}</div>
        <a className="back-link" href="https://www.getdasha.com/">getdasha.com ↗</a>
      </header>

      <section className="command-hero" aria-labelledby="product-title">
        <div>
          <p className="kicker">Open inference · idle machines · source included</p>
          <h1 id="product-title">Make the Macs do something.</h1>
        </div>
        <div className="hero-status">
          <span>Hosted state</span>
          <strong>{networkError ? "Status unavailable" : network.inference_live ? `${network.providers_online} providers online` : "Proof surface only"}</strong>
          <p>The downloadable network runs now. Public routing turns on only when an enrolled provider is ready.</p>
        </div>
      </section>

      <div className="exact-claim"><strong>Exact claim</strong><span>Hosted chat is not live and stores no prompt. Local source routes real requests to Ollama. Provider operators can read them. Do not send secrets.</span></div>

      <nav className="product-nav" aria-label="Dasha Compute sections">
        {NAV.map((item, index) => (
          <button key={item.id} className={view === item.id ? "nav-card active" : "nav-card"} onClick={() => selectView(item.id)} aria-current={view === item.id ? "page" : undefined}>
            <span>0{index + 1}</span><strong>{item.label}</strong><small>{item.note}</small>
          </button>
        ))}
      </nav>

      <section id="workspace" className="workspace" aria-live="polite">
        {view === "use" && (
          <div className="use-grid">
            <section className="primary-panel">
              <div className="panel-head"><div><p className="kicker acid">Request lab</p><h2>Shape the call.</h2></div><span className="status-chip">browser only</span></div>
              <div className="model-row">
                <label htmlFor="model">Model</label>
                <select id="model" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>{MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.size}</option>)}</select>
                <span>{network.models_available.includes(selectedModel) ? "available" : "not hosted"}</span>
              </div>
              <form className="prompt-box" onSubmit={stageRequest}>
                <label htmlFor="prompt">Prompt</label>
                <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
                <div><span>{prompt.length.toLocaleString()} characters · nothing sent</span><button className="primary-button" type="submit">Stage request</button></div>
              </form>
              {stagedPrompt && <div className="staged"><span>Ready for a provider</span><p>{stagedPrompt}</p></div>}
            </section>

            <aside className="request-card">
              <div className="request-head"><div><p className="kicker">OpenAI request</p><h3>Inspect before sending.</h3></div><button className="text-button" onClick={() => copy(requestPreview, "request")}>{copied === "request" ? "Copied" : "Copy JSON"}</button></div>
              <pre><code>{requestPreview}</code></pre>
              <dl className="truth-list">
                <div><dt>Destination</dt><dd>none yet</dd></div>
                <div><dt>Hosted retention</dt><dd>none</dd></div>
                <div><dt>Local provider visibility</dt><dd>plaintext</dd></div>
                <div><dt>Streaming in source</dt><dd>SSE · v0.3</dd></div>
              </dl>
            </aside>

            <section className="wide-card status-row">
              <article><span>Hosted gateway</span><strong>{network.phase.replaceAll("-", " ")}</strong></article>
              <article><span>Providers</span><strong>{network.providers_online}</strong></article>
              <article><span>Queued jobs</span><strong>{network.jobs_queued}</strong></article>
              <article><span>Source network</span><strong>runnable</strong></article>
            </section>
          </div>
        )}

        {view === "provide" && (
          <div className="provide-grid">
            <section className="primary-panel">
              <div className="panel-head"><div><p className="kicker acid">Provider fit</p><h2>What can this Mac run?</h2></div><Mark>▣</Mark></div>
              <div className="form-grid">
                <label>Chip<select value={chip} onChange={(event) => setChip(event.target.value as keyof typeof CHIPS)}>{Object.keys(CHIPS).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Unified memory<select value={ram} onChange={(event) => setRam(Number(event.target.value))}>{RAM_OPTIONS.map((item) => <option key={item} value={item}>{item} GB{item === 192 ? "+" : ""}</option>)}</select></label>
                <label className="range-label">Available daily <strong>{hours}h</strong><input type="range" min="1" max="24" value={hours} onChange={(event) => setHours(Number(event.target.value))} /></label>
                <label className="range-label">Paid utilization assumption <strong>{demand}%</strong><input type="range" min="5" max="80" step="5" value={demand} onChange={(event) => setDemand(Number(event.target.value))} /></label>
              </div>
              <div className="compatible-list">
                <div className="subhead"><h3>{compatibleModels.length} compatible models</h3><span>catalog sizes + memory headroom</span></div>
                {compatibleModels.map((model) => <a href={model.href} key={model.id}><span>{model.label}<small>{model.use}</small></span><strong>{model.size}</strong></a>)}
              </div>
            </section>

            <aside className="capacity-card">
              <p className="kicker">Inspectable scenario</p>
              <strong className="capacity-number">{(capacity.tokens / 1_000_000).toFixed(1)}M<small> tokens/mo</small></strong>
              <label>Output price assumption <span>${tokenRate.toFixed(2)} / 1M</span><input type="range" min="0.25" max="3" step="0.25" value={tokenRate} onChange={(event) => setTokenRate(Number(event.target.value))} /></label>
              <label>Electricity <span>${electricityRate.toFixed(2)} / kWh</span><input type="range" min="0.1" max="0.6" step="0.01" value={electricityRate} onChange={(event) => setElectricityRate(Number(event.target.value))} /></label>
              <dl className="truth-list money-list">
                <div><dt>Gross usage</dt><dd>${capacity.gross.toFixed(2)}</dd></div>
                <div><dt>Estimated power</dt><dd>−${capacity.power.toFixed(2)}</dd></div>
                <div><dt>Usage-only result</dt><dd className={capacity.net >= 0 ? "positive" : "negative"}>{capacity.net < 0 ? "−" : ""}${Math.abs(capacity.net).toFixed(2)}</dd></div>
              </dl>
              <p className="fine-print">No base reward, tax, downtime or hardware cost included. This is math, not a promise.</p>
            </aside>

            <section className="wide-card setup-card">
              <div><p className="kicker acid">Provider #1</p><h3>Recommended: {recommendedModel.label}</h3><p>Install Ollama, download the source, run diagnostics, then connect outbound. No inbound port or wallet required.</p><div className="source-actions"><a className="primary-button" href="/dasha-compute-open-alpha.tar.gz" download>Download v0.3</a><a className="secondary-button" href="https://ollama.com/download">Get Ollama ↗</a></div></div>
              <div className="install-code"><button className="text-button" onClick={() => copy(providerCommand, "provider")}>{copied === "provider" ? "Copied" : "Copy setup"}</button><pre><code>{providerCommand}</code></pre></div>
            </section>
          </div>
        )}

        {view === "build" && (
          <div className="build-grid">
            <section className="primary-panel code-card">
              <div className="panel-head"><div><p className="kicker acid">OpenAI-compatible</p><h2>Change one base URL.</h2></div><Mark>{`{ }`}</Mark></div>
              <div className="code-tabs" role="tablist" aria-label="Code language">{(Object.keys(codeExamples) as CodeLanguage[]).map((key) => <button key={key} className={language === key ? "active" : ""} onClick={() => setLanguage(key)} role="tab" aria-selected={language === key}>{key}</button>)}</div>
              <pre><code>{codeExamples[language]}</code></pre>
              <button className="copy-button" onClick={() => copy(codeExamples[language], "code")}>{copied === "code" ? "Copied" : "Copy example"}</button>
            </section>

            <aside className="gateway-card">
              <div className="request-head"><div><p className="kicker">Hosted status</p><h3>Test the public reads.</h3></div><button className="text-button" onClick={checkGateway} disabled={checkingGateway}>{checkingGateway ? "Checking…" : "Run check"}</button></div>
              <pre><code>{gatewayResult}</code></pre>
              <dl className="truth-list endpoint-list">
                <div><dt>GET</dt><dd>/v1/models</dd></div>
                <div><dt>GET</dt><dd>/v1/network</dd></div>
                <div><dt>POST</dt><dd>/v1/chat/completions</dd></div>
                <div><dt>POST</dt><dd>/v1/providers/poll</dd></div>
              </dl>
            </aside>

            <section className="wide-card architecture-card">
              <div><span>01</span><strong>Client</strong><small>OpenAI SDK · curl</small></div><b>→</b><div><span>02</span><strong>Coordinator</strong><small>auth · queue · SSE</small></div><b>→</b><div><span>03</span><strong>Provider</strong><small>outbound polling</small></div><b>→</b><div><span>04</span><strong>Ollama</strong><small>open weights</small></div>
            </section>
          </div>
        )}

        {view === "source" && (
          <div className="source-grid">
            <section className="primary-panel source-lead">
              <p className="kicker acid">Clean-room · MIT</p>
              <h2>Read it. Run it. Break it usefully.</h2>
              <p>The archive contains the console, API states, coordinator, Python/Ollama provider, streaming protocol, tests, threat model and security policy. No Darkbloom code or branding.</p>
              <div className="source-actions"><a className="primary-button" href="/dasha-compute-open-alpha.tar.gz" download>Download source v0.3</a><a className="secondary-button" href="https://github.com/Uuriko/dasha-desk">$dasha repo ↗</a></div>
              <p className="fine-print">The dedicated public repository replaces the archive handoff when connected.</p>
            </section>

            <aside className="inventory-card">
              <p className="kicker">Inside</p>
              <dl className="truth-list">
                <div><dt>Console</dt><dd>React + CSS</dd></div>
                <div><dt>Coordinator</dt><dd>Node · no deps</dd></div>
                <div><dt>Provider</dt><dd>Python · Ollama</dd></div>
                <div><dt>Streaming</dt><dd>OpenAI SSE</dd></div>
                <div><dt>Tests</dt><dd>nonstream + stream</dd></div>
                <div><dt>License</dt><dd>MIT</dd></div>
              </dl>
            </aside>

            <section className="wide-card principles-grid">
              <article><span>01</span><h3>No fake privacy.</h3><p>The coordinator and provider can read content in v0.3. That changes only after a real threat model and audit.</p></article>
              <article><span>02</span><h3>No token theater.</h3><p>USD or USDC accounting first. $dasha access and recognition can remain optional.</p></article>
              <article><span>03</span><h3>No hidden math.</h3><p>Model sizes, rate assumptions, power assumptions and protocol messages stay visible.</p></article>
              <article><span>04</span><h3>No trapped hardware.</h3><p>Local direct mode remains free. Stop the agent and the machine leaves immediately.</p></article>
            </section>

            <section className="wide-card roadmap-card">
              <div className="done"><span>Done</span><strong>Real local routing</strong><small>OpenAI shape · Ollama · tests</small></div>
              <div className="done"><span>Done</span><strong>SSE streaming</strong><small>chunk relay · disconnect cleanup</small></div>
              <div><span>Next</span><strong>Trusted pilot</strong><small>enrollment · quotas · durable queue</small></div>
              <div><span>Then</span><strong>Security layer</strong><small>encryption · signed builds · audit</small></div>
            </section>
          </div>
        )}
      </section>

      <footer><span>$dasha compute · v0.3 open alpha</span><span>53ux…pump</span><span>not an investment · not Darkbloom</span></footer>
    </main>
  );
}
