module.exports = {
  apps: [
    {
      name: 'indexer',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true,

      // graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,

      // auto-restart on failure
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,

      // watch (dev only, disable in production)
      watch: false,
    },

    {
      name: 'event-listener',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        LISTENER_ONLY: '1',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/listener-error.log',
      out_file: 'logs/listener-out.log',
      merge_logs: true,
      time: true,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 5000,
      watch: false,
    },
  ],
};
