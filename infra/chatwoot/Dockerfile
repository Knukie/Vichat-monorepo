FROM chatwoot/chatwoot:latest-ce

WORKDIR /app

# Entrypoint + custom initializers
COPY entrypoint.sh /entrypoint.sh
COPY initializers/00_ai_agents_guard.rb /app/config/initializers/00_ai_agents_guard.rb
COPY initializers/00_host_uri_guard.rb /app/config/initializers/00_host_uri_guard.rb

# ActiveStorage config
COPY config/storage.yml /app/config/storage.yml

# Brand assets
# - Downloads your PNG into /public/brand-assets/logo.png
# - Writes svg wrappers so if Chatwoot expects logo.svg/logo_dark.svg/logo_thumbnail.svg, it still shows your PNG
RUN set -eux; \
  mkdir -p /app/public/brand-assets; \
  \
  # Ensure curl exists (Debian/Ubuntu or Alpine)
  if ! command -v curl >/dev/null 2>&1; then \
    if command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
      apk add --no-cache curl ca-certificates; \
    else \
      echo "No supported package manager found to install curl" >&2; exit 1; \
    fi; \
  fi; \
  \
  # Download logo PNG
  curl -fsSL "https://szowwbnppsueshvxiwoi.supabase.co/storage/v1/object/public/branding/netco-logo.png" \
    -o /app/public/brand-assets/logo.png; \
  \
  # Create SVG wrapper (covers cases where CE uses logo.svg assets)
  cat > /app/public/brand-assets/logo.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
  <image href="/brand-assets/logo.png" width="240" height="80" preserveAspectRatio="xMidYMid meet"/>
</svg>
SVG
RUN cp /app/public/brand-assets/logo.svg /app/public/brand-assets/logo_dark.svg \
 && cp /app/public/brand-assets/logo.svg /app/public/brand-assets/logo_thumbnail.svg

# Normalize + make entrypoint executable
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "bundle exec puma -C config/puma.rb"]
