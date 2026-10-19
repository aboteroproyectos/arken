// Lo que el programa usa del SDK oficial de Anthropic: el cliente y sus errores.
// herramientas/armar-sdk.mjs lo empaqueta en fuente/sdk/anthropic-sdk.js, que el
// ensamblador pone en el bloque <script id="arken-analytica-sdk">.
export {
  Anthropic,
  APIError,
  APIUserAbortError,
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitError,
  BadRequestError,
  InternalServerError,
} from '@anthropic-ai/sdk';
