// Lo que el programa usa del SDK oficial de Anthropic: el cliente y sus errores.
// herramientas/armar-sdk.mjs lo empaqueta en el bloque <script id="arken-precios-sdk">.
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
