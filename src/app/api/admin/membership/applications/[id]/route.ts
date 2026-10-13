import {
  requireReviewer,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { reviewApplication } from "@/lib/services/member-service";
import { reviewSchema } from "@/lib/validation";
import { z } from "zod";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const reviewer = await requireReviewer(request.headers);
    return json(
      await reviewApplication(
        reviewer.id,
        z.uuid().parse((await params).id),
        reviewSchema.parse(await readJson(request)),
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
