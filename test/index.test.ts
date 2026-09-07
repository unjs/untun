import { it, describe, expectTypeOf } from "vitest";
import { startTunnel, type Tunnel } from "../src/index.ts";

describe("untun", () => {
  it("type inference for startTunnel return type", () => {
    expectTypeOf(startTunnel({ acceptCloudflareNotice: true })).toEqualTypeOf<Promise<Tunnel>>();
    expectTypeOf(startTunnel({ acceptCloudflareNotice: false })).toEqualTypeOf<
      Promise<undefined | Tunnel>
    >();
    expectTypeOf(startTunnel({})).toEqualTypeOf<Promise<undefined | Tunnel>>();
    expectTypeOf(startTunnel()).toEqualTypeOf<Promise<undefined | Tunnel>>();
  });
});
