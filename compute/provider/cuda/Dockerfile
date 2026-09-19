# Dasha Compute CUDA training image (pinned).
#
# Build: docker build --build-arg UNSLOTH_VERSION=<verify-on-PyPI-first> \
#          -t dasha-cuda-train:<UNSLOTH_VERSION> compute/provider/cuda
#
# The daemon runs the generated train.py inside this image (opt-in via
# DASHA_CUDA_DOCKER_IMAGE); the coordinator pins the exact image digest
# per training fleet so every provider trains bit-identical software.
# VERIFY UNSLOTH_VERSION against PyPI before building — Unsloth is
# fast-moving and the generated script needs FastLanguageModel.get_peft_model
# with use_dora + unsloth.chat_templates.train_on_responses_only.

ARG CUDA_VERSION=12.6.3
ARG UBUNTU_VERSION=22.04
FROM nvidia/cuda:${CUDA_VERSION}-runtime-ubuntu${UBUNTU_VERSION}

ARG TORCH_VERSION=2.8.0
ARG TORCH_CUDA=cu126
ARG UNSLOTH_VERSION=2026.2.1
ARG TRCH_VERSION_HINT=""

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3.11 python3.11-venv python3-pip git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# Torch first (CUDA wheel), then the pinned Unsloth stack. Unsloth pulls
# trl/transformers/peft/datasets itself; we pin the ones we generate code
# against so the script surface can't drift under us.
RUN pip install --no-cache-dir \
      "torch==${TORCH_VERSION}" \
      --index-url "https://download.pytorch.org/whl/${TORCH_CUDA}" \
 && pip install --no-cache-dir \
      "unsloth==${UNSLOTH_VERSION}" \
      "trl==0.15.2" \
      "transformers==4.52.4" \
      "datasets==3.6.0" \
      "peft==0.15.2" \
      "huggingface_hub==0.32.4" \
      "safetensors==0.5.3"

# Non-root trainer user. The daemon bind-mounts the job workdir at the same
# absolute path (see CUDA-SANDBOX.md), so baked-in absolute paths keep
# working; HOME is writable for HF caches that must not be read-only.
RUN useradd -m -u 10001 trainer
USER trainer
WORKDIR /job

LABEL org.dasha.compute="cuda-train" \
      org.dasha.unsloth-version="${UNSLOTH_VERSION}" \
      org.dasha.cuda-version="${CUDA_VERSION}"
