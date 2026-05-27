import { HttpException } from "@nestjs/common/exceptions/http.exception";
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import { Message } from "@libs/localization";
import { LANG_HEADER } from "../constants";

export const ErrorException = (
  e: any,
  defaultMessage: string,
  defaultStatus: number,
) => {
  const message = e?.message || defaultMessage;
  const status = e?.status || defaultStatus;

  throw new HttpException(message, status);
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const contextType = host.getType() as string;
    const isHttp = contextType === "http";
    const isGql = contextType === "graphql";

    let request: any;

    if (isHttp) {
      const ctx = host.switchToHttp();
      request = ctx.getRequest();
    } else if (isGql) {
      const gqlCtx = GqlExecutionContext.create(host as any);
      request = gqlCtx.getContext()?.req;
    } else {
      request = null;
    }

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : exception?.extensions?.statusCode ||
        exception?.extensions?.response?.statusCode ||
        exception?.status ||
        (exception instanceof GraphQLError ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR);

    // ✅ Safe response extraction
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception?.response || null);

    let rawMessage: any = exception?.message || "Something went wrong";

    if (typeof exceptionResponse === "string") {
      rawMessage = exceptionResponse;
    } else if (
      exceptionResponse &&
      typeof exceptionResponse === "object"
    ) {
      const responseObj = exceptionResponse as any;

      // validation error array
      if (Array.isArray(responseObj.message)) {
        rawMessage = responseObj.message[0];
      } else if (responseObj.message) {
        rawMessage = responseObj.message;
      }
    }

    let defaultLanguage = "EN";

    if (request?.headers?.[LANG_HEADER]) {
      defaultLanguage =
        request.headers[LANG_HEADER] === "NP" ? "NP" : "EN";
    }

    const translatedMessage = Message(
      defaultLanguage,
      rawMessage,
    );

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url,
      message: translatedMessage,
      code: this.getErrorCode(status),
    };

    if (isGql) {
      throw new GraphQLError(translatedMessage, {
        extensions: errorResponse,
      });
    }

    if (isHttp) {
      const response = host.switchToHttp().getResponse();
      return response.status(status).json(errorResponse);
    }

    return exception;
  }

  private getErrorCode(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'BAD_USER_INPUT',
    };
    return map[status] || 'INTERNAL_SERVER_ERROR';
  }
}