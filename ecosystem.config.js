module.exports = {
  apps: [{
    name: 'clawx-web',
    script: 'dist-server/index.js',
    cwd: '/root/ClawX-Web',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 2003
    },
    error_file: '/var/log/clawx-web-error.log',
    out_file: '/var/log/clawx-web-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
