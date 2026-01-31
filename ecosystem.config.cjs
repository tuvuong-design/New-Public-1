/**
 * PM2 config cho aaPanel / VPS
 * - App Next: npm run build && pm2 start ecosystem.config.cjs
 * - Worker (BullMQ watchers): build worker trước (npm run build sẽ build worker)
 */
module.exports = {
  apps: [
    {
      name: "videoshare-web",
      cwd: "/mnt/data/work_v6",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
    {
      name: "videoshare-worker",
      cwd: "/mnt/data/work_v6",
      script: "worker/dist/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
