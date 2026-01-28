FROM chatwoot/chatwoot:latest-ce

WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
COPY initializers/00_ai_agents_guard.rb /app/config/initializers/00_ai_agents_guard.rb
COPY initializers/00_host_uri_guard.rb /app/config/initializers/00_host_uri_guard.rb

RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "bundle exec puma -C config/puma.rb -p ${PORT:-3000} -b 0.0.0.0"]
