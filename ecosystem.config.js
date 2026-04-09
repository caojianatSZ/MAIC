module.exports = {
  apps: [
    {
      name: 'openmaic-web',
      script: 'node',
      args: 'node_modules/next/dist/bin/next start',
      cwd: '/opt/openmaic',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env_file: '/opt/openmaic/.env.qa',
      error_file: '/var/log/openmaic-error.log',
      out_file: '/var/log/openmaic-out.log',
      log_file: '/var/log/openmaic-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      // 使用.env.qa中的环境变量，包括NODE_ENV=production
      // 开发模式优势：支持热重载，便于调试
    }
  ]
};
