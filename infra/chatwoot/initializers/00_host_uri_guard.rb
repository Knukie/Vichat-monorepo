# frozen_string_literal: true

require "uri"

module HostUriGuard
  module_function

  DISABLE_FLAG = "DISABLE_HOST_URI_GUARD"

  def disabled?
    ENV[DISABLE_FLAG].to_s.strip == "1"
  end

  def present?(value)
    value.is_a?(String) && !value.strip.empty?
  end

  def invalid_host?(value)
    !present?(value) || value.strip == "0.0.0.0"
  end

  def safe_parse_url(value)
    return [nil, nil] unless present?(value)

    uri = URI.parse(value)
    [uri.host, uri.scheme]
  rescue URI::InvalidURIError
    [nil, nil]
  end

  def extract_host
    return ENV["APP_HOST"].to_s.strip if present?(ENV["APP_HOST"])
    return ENV["RAILS_HOST"].to_s.strip if present?(ENV["RAILS_HOST"])

    backend_host, = safe_parse_url(ENV["BACKEND_URL"])
    return backend_host.to_s.strip if present?(backend_host)

    frontend_host, = safe_parse_url(ENV["FRONTEND_URL"])
    return frontend_host.to_s.strip if present?(frontend_host)

    nil
  end

  def choose_protocol
    _, backend_scheme = safe_parse_url(ENV["BACKEND_URL"])
    _, frontend_scheme = safe_parse_url(ENV["FRONTEND_URL"])

    (backend_scheme == "https" || frontend_scheme == "https") ? "https" : "http"
  end

  def log_warn(message)
    if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
      Rails.logger.warn(message)
    else
      warn(message)
    end
  end

  def apply_default_url_options(target, host, protocol)
    return unless target.respond_to?(:default_url_options)

    target.default_url_options ||= {}
    target.default_url_options[:host] = host
    target.default_url_options[:protocol] = protocol
  end
end

# --- initializer body ---
begin
  unless HostUriGuard.disabled?
    if defined?(Rails) && Rails.respond_to?(:application) && Rails.application
      host = HostUriGuard.extract_host
      protocol = HostUriGuard.choose_protocol

      if HostUriGuard.present?(host) && HostUriGuard.invalid_host?(ENV["HOST"])
        ENV["HOST"] = host
        HostUriGuard.log_warn("HOST was invalid/empty. Overriding HOST to '#{host}'.")
      end

      if HostUriGuard.present?(host)
        Rails.application.routes.default_url_options[:host] = host
        Rails.application.routes.default_url_options[:protocol] = protocol

        if Rails.application.config.respond_to?(:action_mailer)
          HostUriGuard.apply_default_url_options(Rails.application.config.action_mailer, host, protocol)
        end

        if Rails.application.config.respond_to?(:action_controller)
          HostUriGuard.apply_default_url_options(Rails.application.config.action_controller, host, protocol)
        end
      end
    end
  end
rescue StandardError, URI::InvalidURIError => e
  HostUriGuard.log_warn("HostUriGuard failed safely: #{e.class}: #{e.message}")
end
