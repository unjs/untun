import { existsSync } from "node:fs";
import consola from "consola";

export interface TunnelOptions {
  url?: string;
  port?: number | string;
  hostname?: string;
  protocol?: "http" | "https";
  verifyTLS?: boolean;
}

export interface Tunnel {
  getURL: () => Promise<string>;
  close: () => Promise<void>;
}

export async function startTunnel(
  opts: TunnelOptions,
): Promise<undefined | Tunnel> {
  const {
    installCloudflared,
    startCloudflaredTunnel,
    cloudflaredBinPath,
    cloudflaredNotice,
  } = await import("./cloudflared");

  const url =
    opts.url ||
    `${opts.protocol || "http"}://${opts.hostname ?? "localhost"}:${
      opts.port ?? 3000
    }`;

  consola.start(`Starting cloudflared tunnel to ${url}`);

  if (!existsSync(cloudflaredBinPath)) {
    consola.log(cloudflaredNotice);
    const canInstall = await consola.prompt(
      `Do you agree with the above terms and wish to install the binary from GitHub?`,
      {
        type: "confirm",
      },
    );
    if (!canInstall) {
      consola.fail("Skipping tunnel setup.");
      return;
    }
    await installCloudflared();
  }

  const args = [
    ["--url", url],
    opts.verifyTLS ? undefined : ["--no-tls-verify", ""],
  ].filter(Boolean) as [string, string][];

  const tunnel = await startCloudflaredTunnel(Object.fromEntries(args));

  const cleanup = async () => {
    await tunnel.stop();
  };
  for (const signal of ["SIGINT", "SIGUSR1", "SIGUSR2"] as const) {
    process.once(signal, cleanup);
  }

  return {
    getURL: async () => await tunnel.url,
    close: async () => {
      await cleanup();
    },
  };
}
