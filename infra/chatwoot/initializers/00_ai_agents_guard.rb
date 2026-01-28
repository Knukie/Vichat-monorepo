enabled = ENV.fetch("ENABLE_AI_AGENTS", "false").casecmp("true").zero?

def set_ai_agents_enabled(value)
  config_x = Rails.application.config.x
  if config_x.respond_to?(:ai_agents_enabled=)
    config_x.ai_agents_enabled = value
  elsif config_x.respond_to?(:[]=)
    config_x[:ai_agents_enabled] = value
  else
    Rails.logger.warn("[ai_agents] Unable to set ai_agents_enabled on config.x; missing setter/hash access.")
  end
end

set_ai_agents_enabled(enabled)

if !enabled
  Rails.logger.warn("[ai_agents] ENABLE_AI_AGENTS is false; skipping AI agent configuration.")
else
  begin
    unless ActiveRecord::Base.connection.data_source_exists?("installation_configs")
      Rails.logger.warn("[ai_agents] installation_configs table missing; disabling AI agents.")
      ENV["ENABLE_AI_AGENTS"] = "false"
      set_ai_agents_enabled(false)
    end
  rescue ActiveRecord::NoDatabaseError,
         ActiveRecord::ConnectionNotEstablished,
         PG::ConnectionBad,
         StandardError => e
    Rails.logger.warn("[ai_agents] Database not ready (#{e.class}: #{e.message}); disabling AI agents.")
    ENV["ENABLE_AI_AGENTS"] = "false"
    set_ai_agents_enabled(false)
  end
end
