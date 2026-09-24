module.exports = {
  apps: [
    {
      name: 'gestordevendas',
      // Roda o codigo ja compilado (npm run build -> dist/). Antes rodava
      // ts-node direto do src/, que compila tudo em memoria a cada restart,
      // usa bem mais RAM e deixa o servidor mais lento.
      script: 'dist/main.js',
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
