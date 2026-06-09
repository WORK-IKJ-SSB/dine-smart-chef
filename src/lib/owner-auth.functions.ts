import { createServerFn } from "@tanstack/react-start";

export const verifyOwnerPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => {
    if (typeof data?.password !== "string" || data.password.length > 200) {
      throw new Error("Invalid password");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const expected = process.env.OWNER_PASSWORD;
    if (!expected) throw new Error("Owner password not configured");
    return { ok: data.password === expected };
  });