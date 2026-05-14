import { registerEnumType } from '@nestjs/graphql';

export enum TokenGrantType {
  ACCESS_TOKEN = 'access',
  REFRESH_TOKEN = 'refresh_token',
  PASSWORD_RESET = 'password_reset',
  IMPERSONATION = 'impersonation',
  SET_PASSWORD = 'set_password',
}

registerEnumType(TokenGrantType, {
  name: 'TokenGrantType',
  description: 'Enum for different token grant types used in authentication',
  valuesMap: {
    ACCESS_TOKEN: {
      description: 'All token types',
    },
    REFRESH_TOKEN: {
      description: 'Token used for refreshing access tokens',
    },
    PASSWORD_RESET: {
      description: 'Token used for password reset requests',
    },
    IMPERSONATION: {
      description: 'Token used for user impersonation by admins',
    },
  },
});
