import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project lives in a folder alongside other lockfiles; pin the
  // workspace root so Next (and Vercel) trace files from here.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
