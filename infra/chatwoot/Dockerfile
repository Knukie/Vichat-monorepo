FROM chatwoot/chatwoot:latest-ce

WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
COPY initializers/00_ai_agents_guard.rb /app/config/initializers/00_ai_agents_guard.rb
COPY initializers/00_host_uri_guard.rb /app/config/initializers/00_host_uri_guard.rb

RUN sed -i 's/\r$//' /entrypoint.sh \
 && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]