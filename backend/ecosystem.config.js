module.exports = {
  apps: [
    {
      name: "backend",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "worker",
      script: "dist/worker.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
