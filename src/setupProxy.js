const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://108.181.203.232:3001",
      changeOrigin: true,
      secure: false,
    })
  );
};
