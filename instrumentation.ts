import { assertRuntimeEnvAtStartup } from "@/lib/runtime-env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertRuntimeEnvAtStartup();
  }
}
