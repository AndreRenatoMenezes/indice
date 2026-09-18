import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // imagem enxuta para Cloud Run
  transpilePackages: ["@indice/shared"],
};

export default nextConfig;
