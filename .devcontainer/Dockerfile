# Match the Node version used by the application Dockerfiles and the CI pipeline.
FROM node:22

WORKDIR /workspace

# Install basic tools used by the local workflow and mask tasks.
RUN apt-get update && apt-get install -y \
    git \
    wget \
    unzip \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install the mask CLI. A prebuilt binary only exists for x86_64 Linux, so on
# other architectures we skip it gracefully — the documented npm commands still work.
ARG MASK_VERSION=0.11.6
RUN set -eu; \
    arch="$(uname -m)"; \
    if [ "$arch" = "x86_64" ]; then \
        wget -O /tmp/mask.zip "https://github.com/jacobdeichert/mask/releases/download/mask/${MASK_VERSION}/mask-${MASK_VERSION}-x86_64-unknown-linux-gnu.zip" \
            && unzip /tmp/mask.zip -d /tmp \
            && mv "/tmp/mask-${MASK_VERSION}-x86_64-unknown-linux-gnu/mask" /usr/local/bin/mask \
            && chmod +x /usr/local/bin/mask \
            && rm -rf /tmp/mask.zip "/tmp/mask-${MASK_VERSION}-x86_64-unknown-linux-gnu"; \
    else \
        echo "mask has no prebuilt binary for ${arch}; use the documented npm commands instead"; \
    fi

# Keep the container running
CMD ["tail", "-f", "/dev/null"]
