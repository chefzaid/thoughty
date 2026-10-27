import { checkMultipartRequest, recordContractViolations } from "./mockApp.contract";
import { fulfillApiError, type RouteContext } from "./mockApp.route-utils";

/**
 * Refuses an upload the way the API does when its multipart body carries another content type (or no
 * boundary), and fails the test that sent it: the app may swallow the error, as an entry saved without its
 * attachment does.
 */
export async function refuseMislabelledUpload({ route, request, pathname }: RouteContext): Promise<boolean> {
  const hasBody = (request.postDataBuffer()?.length ?? 0) > 0;
  const problem = checkMultipartRequest(request.method(), pathname, request.headers()["content-type"], hasBody);
  if (!problem) return false;
  recordContractViolations([problem]);
  await fulfillApiError(route, 400, "VALIDATION_FAILED", problem);
  return true;
}
