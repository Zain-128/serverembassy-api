module.exports = {
  apps: [
    {
      name: "serverembassy-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    }
  ]
};
