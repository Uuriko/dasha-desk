# CUDA lane sandboxing

The CUDA lane is the one place in Dasha Compute where per-job sandboxing is
real: Docker works on Linux with GPUs, which macOS cannot do (no Metal in
containers/VMs). This doc defines the boundary.

## Boundary

- **Host (trusted):** the provider daemon (`agent.py`, `DASHA_BACKEND=finetune`).
  It owns identity, polling, heartbeats, the watchdog, dataset staging, and
  artifact upload. It never runs training code itself.
- **Container (untrusted-ish):** exactly one process — the generated
  `train.py` from `finetune_runner_cuda.generate_config()`. The script is
  still fully declarative (generated from the validated spec, never
  client-supplied), so the container is defense-in-depth, not the primary
  control.

## Run flags (what `_dockerize()` emits)

```
docker run --rm \
  --gpus '"device=0"' \
  --network none \
  --memory <vram_gb - 3>g \
  --pids-limit 1024 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -v <workdir>:<workdir> \
  -v <model-cache>:<model-cache>:ro \
  -w <workdir> \
  <image> python3 <workdir>/train.py
```

- `--gpus '"device=0"'`: exactly one GPU. Multi-GPU jobs are not in v2.
- `--network none`: training needs no network after staging. The daemon
  stages the dataset and base-model weights on the host *before* launch;
  progress reaches the coordinator via the host-side `progress_callback`,
  never from inside the container.
- Bind-mounts use the **same absolute path** inside and outside so the
  absolute paths baked into the generated script stay valid.
- Model cache is **read-only**: the trainer cannot poison shared weights.
- Exactly one writable dir: the job workdir (dataset, checkpoints,
  adapters).

## Watchdog (host-side, outside the container)

`finetune_runner_cuda.Watchdog` polls every 15 s:

- wall-clock deadline from the job's `expires_at` (minus 5 min margin);
- VRAM via `nvidia-smi` on device 0 — kill when used VRAM exceeds
  `total_vram - 1 GB`.

On breach: `docker kill` equivalent (`process.kill()` on the docker client),
then the preemption path uploads whatever adapters exist as a
`checkpoint_ref` for resume (`save_steps` + `resume_from_checkpoint`).

## Image pinning policy

- The Dockerfile pins CUDA, torch (cu126 wheel), `unsloth`, `trl`,
  `transformers`, `datasets`, `peft`, `huggingface_hub`, `safetensors`.
- **Verify `UNSLOTH_VERSION` against PyPI before every image build.**
  The generated script uses `FastLanguageModel.get_peft_model(use_dora=…)`
  and `unsloth.chat_templates.train_on_responses_only`; both must exist in
  the pinned release or training fails closed (TypeError at startup —
  loud, not silent).
- The coordinator records the image digest per training fleet; providers
  outside the pinned digest set are not matched to tune jobs (server-side
  enforcement lands with the fleet work, not in this branch).
- Host requirements (checked by `doctor()` before the engine advertises):
  Nvidia driver with CUDA ≥ 12.0, compute capability ≥ 8.0 (bf16).
  Below that the `cuda` engine is silently not advertised — no partial
  training, no fallback.

## Opt-in

Docker is opt-in per provider: set `DASHA_CUDA_DOCKER_IMAGE` to the pinned
image (digest-pinned form recommended, e.g.
`dasha-cuda-train@sha256:…`). Unset → the daemon runs `train.py` on the
host with the same watchdog. The declarative-spec guarantee holds either
way; Docker adds isolation, not trust.
