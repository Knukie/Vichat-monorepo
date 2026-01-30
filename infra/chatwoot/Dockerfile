FROM chatwoot/chatwoot:latest-ce

WORKDIR /app

# Entrypoint + custom initializers
COPY entrypoint.sh /entrypoint.sh
COPY initializers/00_ai_agents_guard.rb /app/config/initializers/00_ai_agents_guard.rb
COPY initializers/00_host_uri_guard.rb /app/config/initializers/00_host_uri_guard.rb

# ActiveStorage config
COPY config/storage.yml /app/config/storage.yml

# Normalize line endings + make entrypoint executable
RUN sed -i 's/\r$//' /entrypoint.sh \
 && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "bundle exec puma -C config/puma.rb"]
