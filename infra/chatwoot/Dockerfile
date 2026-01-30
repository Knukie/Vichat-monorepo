FROM chatwoot/chatwoot:latest-ce

WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
COPY initializers/00_ai_agents_guard.rb /app/config/initializers/00_ai_agents_guard.rb
COPY initializers/00_host_uri_guard.rb /app/config/initializers/00_host_uri_guard.rb

# ActiveStorage config
COPY config/storage.yml /app/config/storage.yml

# ✅ Download your logo into the container so LOGO can point to a local static path
# (Works even if Chatwoot CE doesn't accept remote LOGO URLs)
RUN set -eux; \
    mkdir -p /app/public/brand-assets; \
    if ! command -v curl >/dev/null 2>&1; then \
      if command -v apt-get >/dev/null 2>&1; then \
        apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*; \
      elif command -v apk >/dev/null 2>&1; then \
        apk add --no-cache curl ca-certificates; \
      fi; \
    fi; \
    curl -L "https://szowwbnppsueshvxiwoi.supabase.co/storage/v1/object/public/branding/netco-logo.png" \
      -o /app/public/brand-assets/logo.png

RUN sed -i 's/\r$//' /entrypoint.sh \
 && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh","-c","bundle exec puma -C config/puma.rb"]
