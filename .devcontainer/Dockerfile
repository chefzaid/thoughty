FROM node:24

WORKDIR /workspace

# Install basic tools
RUN apt-get update && apt-get install -y \
    git \
    wget 
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install mask CLI
RUN wget -O /tmp/mask.zip https://github.com/jacobdeichert/mask/releases/download/mask/0.11.6/mask-0.11.6-x86_64-unknown-linux-gnu.zip \
    && unzip /tmp/mask.zip -d /tmp \
    && mv /tmp/mask-0.11.6-x86_64-unknown-linux-gnu/mask /usr/local/bin/mask \
    && chmod +x /usr/local/bin/mask \
    && rm -rf /tmp/mask.zip /tmp/mask-0.11.6-x86_64-unknown-linux-gnu

# Keep the container running
CMD ["tail", "-f", "/dev/null"]
