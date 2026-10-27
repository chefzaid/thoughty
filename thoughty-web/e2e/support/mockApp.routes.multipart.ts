import { checkJsonRequestBody, checkMultipartRequest, checkQueryParameters, recordContractViolations } from "./mockApp.contract";
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

/**
 * Refuses a query string the API's strict boolean and number parsing would refuse (400 VALIDATION_FAILED),
 * and fails the test that sent it.
 */
export async function refuseInvalidQueryParameters({ route, request, pathname, searchParams }: RouteContext): Promise<boolean> {
  const problems = checkQueryParameters(request.method(), pathname, searchParams);
  if (problems.length === 0) return false;
  recordContractViolations(problems);
  await fulfillApiError(route, 400, "VALIDATION_FAILED", problems.join("; "));
  return true;
}

/**
 * Refuses a JSON body whose values the API would refuse for their type (a number sent as `""`, a text sent
 * as a number, a property it does not take), and fails the test that sent it.
 */
export async function refuseInvalidJsonBody({ route, request, pathname }: RouteContext): Promise<boolean> {
  if (!(request.headers()["content-type"] ?? "").toLowerCase().startsWith("application/json")) return false;
  const raw = request.postData();
  if (!raw) return false;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return false;
  }
  const problems = checkJsonRequestBody(request.method(), pathname, body);
  if (problems.length === 0) return false;
  recordContractViolations(problems);
  await fulfillApiError(route, 400, "VALIDATION_FAILED", problems.join("; "));
  return true;
}
