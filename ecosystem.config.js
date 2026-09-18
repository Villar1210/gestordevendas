module.exports = {
  apps: [
    {
      name: 'gestordevendas',
      script: '/var/www/gestordevendas/node_modules/.bin/ts-node',
      args: '-T src/main.ts',
      cwd: '/var/www/gestordevendas',
      env: {
        NODE_ENV: 'production',
        PORT: '3333',
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
    {
      name: 'gestordevendas-frontend',
      script: 'npm',
      args: 'start -- -p 3004',
      cwd: '/var/www/gestordevendas/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: '3004',
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
