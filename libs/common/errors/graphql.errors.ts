import { ApolloServerErrorCode } from '@apollo/server/errors';
import { GraphQLError } from 'graphql';

enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
}

export class BadRequestError extends GraphQLError {
  constructor(message: string, error?: Object) {
    super(message, {
      extensions: {
        code: ApolloServerErrorCode.BAD_REQUEST,
        originalError: error,
        response: {
          statusCode: 400,
          message: message,
          error: 'Bad Request',
        },
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message: string, error?: Object) {
    super(message, {
      extensions: {
        code: ErrorCode.NOT_FOUND,
        originalError: error,
        response: {
          statusCode: 404,
          message: message,
          error: 'Not Found',
        },
      },
    });
  }
}

export interface ValidationErrorItem {
  field: string;
  messages: string[];
}

export class ValidationError extends GraphQLError {
  constructor(message: string, validationErrors?: ValidationErrorItem[], error?: any) {
    super(message, {
      extensions: {
        code: ApolloServerErrorCode.BAD_USER_INPUT,
        originalError: error,
        errors: validationErrors,
        response: {
          statusCode: 422,
          message: message,
          error: 'Validation Error',
          details: error?.message || [],
        },
      },
    });
  }
}

export class ServerError extends GraphQLError {
  constructor(message: string, error?: any) {
    super(message, {
      extensions: {
        code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR,
        originalError: error,
        response: {
          statusCode: 500,
          message: message,
          error: 'Internal Server Error',
          details: error?.message || [],
        },
      },
    });
  }
}

export class UnauthorizedError extends GraphQLError {
  constructor(message: string, error?: Object) {
    super(message, {
      extensions: {
        code: ErrorCode.UNAUTHENTICATED,
        originalError: error,
        response: {
          statusCode: 401,
          message: message,
          error: 'Unauthorized',
        },
      },
    });
  }
}
