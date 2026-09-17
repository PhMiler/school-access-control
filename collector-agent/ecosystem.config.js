module.exports = {
  apps: [
    {
      name: "educontrol-collector",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      time: true,
    },
  ],
};
