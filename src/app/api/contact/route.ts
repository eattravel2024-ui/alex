import { isIP } from "node:net";
import { contactSchema } from "@/lib/contact-validation";
import { submitContact } from "@/lib/services/contact-service";
import { contactEnabled } from "@/lib/server/contact-settings";
import { assertSameOrigin, readJson, json, handleError, ServiceError } from "@/lib/server/access";
import { allowAccountAttempt } from "@/lib/server/auth-throttle";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!contactEnabled()) throw new ServiceError(503, "CONTACT_CLOSED", "示範聯絡提交尚未開放。");
    const input = contactSchema.parse(await readJson(request, 16384));
    // VPS Nginx appends the actual peer address. Never trust an injected first hop.
    const peer = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
    const ip = isIP(peer) ? peer : "unknown";
    if (!(await allowAccountAttempt("contact-ip", ip, 10)) ||
      !(await allowAccountAttempt("contact-email", input.email, 3)))
      throw new ServiceError(429, "RATE_LIMITED", "提交次數過多，請10分鐘後再試。");
    return json(await submitContact(input), 201);
  } catch (error) { return handleError(error); }
}
