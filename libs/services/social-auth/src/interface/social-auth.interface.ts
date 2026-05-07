export interface SocialAuthResponse {
  providerId: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface ISocialAuthService {
  validateToken(token: string): Promise<SocialAuthResponse>;
}
