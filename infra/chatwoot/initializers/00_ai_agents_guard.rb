enabled = ENV.fetch("ENABLE_AI_AGENTS", "false").casecmp("true").zero?
Rails.application.config.x.ai_agents_enabled = enabled

if !enabled
  Rails.logger.warn("[ai_agents] ENABLE_AI_AGENTS is false; skipping AI agent configuration.")
else
  begin
    unless ActiveRecord::Base.connection.data_source_exists?("installation_configs")
      Rails.logger.warn("[ai_agents] installation_configs table missing; disabling AI agents.")
      ENV["ENABLE_AI_AGENTS"] = "false"
      Rails.application.config.x.ai_agents_enabled = false
    end
  rescue ActiveRecord::NoDatabaseError,
         ActiveRecord::ConnectionNotEstablished,
         PG::ConnectionBad,
         StandardError => e
    Rails.logger.warn("[ai_agents] Database not ready (#{e.class}: #{e.message}); disabling AI agents.")
    ENV["ENABLE_AI_AGENTS"] = "false"
    Rails.application.config.x.ai_agents_enabled = false
  end
end
