import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  reviewIssuerApplication,
  TecAuthorizationError,
  TecInputError,
} from "../../../../../lib/tec";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { applicationId } = await params;
    const review = await reviewIssuerApplication(
      user,
      decodeURIComponent(applicationId),
      await request.json(),
    );
    return Response.json({ review });
  } catch (error) {
    const status =
      error instanceof TecAuthorizationError || error instanceof TecInputError
        ? error.status
        : 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Review failed." },
      { status },
    );
  }
}
