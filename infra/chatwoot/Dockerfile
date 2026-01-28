FROM chatwoot/chatwoot:latest-ce

COPY entrypoint.sh /entrypoint.sh
COPY initializers/00_ai_agents_guard.rb /app/config/initializers/00_ai_agents_guard.rb

RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

# laat CMD bestaan → wordt door entrypoint uitgevoerd
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
