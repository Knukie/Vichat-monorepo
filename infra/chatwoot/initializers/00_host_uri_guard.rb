# frozen_string_literal: true

require "uri"

module HostUriGuard
  module_function

  def present?(value)
    value.is_a?(String) && !value.strip.empty?
  end

  def parse_url(value)
    return [nil, nil] unless present?(value)

    uri = URI.parse(value)
    [uri.host, uri.scheme]
  rescue URI::InvalidURIError
    [nil, nil]
  end

  def choose_host
    return ENV["APP_HOST"] if present?(ENV["APP_HOST"])
    return ENV["RAILS_HOST"] if present?(ENV["RAILS_HOST"])

    backend_host, = parse_url(ENV["BACKEND_URL"])
    return backend_host if present?(backend_host)

    frontend_host, = parse_url(ENV["FRONTEND_URL"])
    return frontend_host if present?(frontend_host)

    nil
  end

  def choose_protocol
    _, backend_scheme = parse_url(ENV["BACKEND_URL"])
    _, frontend_scheme = parse_url(ENV["FRONTEND_URL"])

    return "https" if backend_scheme == "https" || frontend_scheme == "https"

    "http"
  end

  def log_warn(message)
    if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
      Rails.logger.warn(message)
    else
      warn(message)
    end
  end
end

if defined?(Rails) && Rails.respond_to?(:application) && Rails.application
  host = HostUriGuard.choose_host
  protocol = HostUriGuard.choose_protocol

  if HostUriGuard.present?(host)
    current_host = ENV["HOST"]
    if !HostUriGuard.present?(current_host) || current_host == "0.0.0.0"
      ENV["HOST"] = host
      HostUriGuard.log_warn("HOST was invalid or empty. Overriding HOST to '#{host}'.")
    end

    Rails.application.routes.default_url_options[:host] = host
    Rails.application.routes.default_url_options[:protocol] = protocol
  end
end
