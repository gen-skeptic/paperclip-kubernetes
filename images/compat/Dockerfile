# Future credential-free build recipe; CI never builds or publishes it.
FROM ghcr.io/paperclipai/paperclip:2026.1001.0@sha256:08dbadebd4d40550eb336c25c3691f582322a88bae3f1cca101c5dd096bdc9d3
USER 1000:1000
COPY --chown=1000:1000 images/compat/patch-adapter.mjs /app/paperclip-codex-mcp-compat.mjs
COPY third_party/PAPERCLIP-LICENSE /usr/share/doc/paperclip-companion/PAPERCLIP-LICENSE
COPY LICENSE /usr/share/doc/paperclip-companion/LICENSE
COPY NOTICE.md /usr/share/doc/paperclip-companion/NOTICE.md
RUN node /app/paperclip-codex-mcp-compat.mjs
LABEL org.opencontainers.image.source="https://github.com/gen-skeptic/paperclip-kubernetes" \
      org.opencontainers.image.licenses="MIT" \
      io.paperclip-companion.upstream-commit="8f8a0ab7effbd6a0584107d8038736c134ee5047" \
      io.paperclip-companion.compatibility="codex-managed-mcp-http-headers-v1"
# MIT identifies the project license, not the entire bundled dependency inventory.
# Inherit upstream entrypoint, command and tools unchanged.
