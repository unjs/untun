import { defineCommand, type CommandDef, runMain as _runMain } from "citty";
import consola from "consola";
import pkg from "../package.json" with { type: "json" };
import { startTunnel } from "./tunnel.ts";

export const tunnel: CommandDef<any> = defineCommand({
  meta: {
    name: "tunnel",
    description: "Create a tunnel to a local server",
  },
  args: {
    url: {
      type: "positional",
      description: "The URL of the tunnel",
      required: false,
    },
    port: {
      type: "string",
      description: "The port of the tunnel (default: 3000)",
    },
    hostname: {
      type: "string",
      description: "The hostname of the tunnel (default: localhost)",
      valueHint: "localhost|example.com",
    },
    protocol: {
      type: "string",
      description: "The protocol of the tunnel (default: http)",
      valueHint: "http|https",
    },
  },
  async run({ args }) {
    const tunnel = await startTunnel({
      url: args.url as string,
    });

    if (!tunnel) {
      console.log("Tunnel not started.");
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }

    consola.info("Waiting for tunnel URL...");
    consola.success(`Tunnel ready at \`${await tunnel.getURL()}\``);
  },
});

export const main: CommandDef<any> = defineCommand({
  meta: {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
  },
  subCommands: {
    tunnel,
  },
});

export const runMain: () => Promise<void> = () => _runMain(main);
