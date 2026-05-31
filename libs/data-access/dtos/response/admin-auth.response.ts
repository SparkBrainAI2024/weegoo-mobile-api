// libs/data-access/src/dto/admin/admin-auth.response.ts
import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AdminUserResponse {
  @Field()
  _id: string;

  @Field()
  fullName: string;

  @Field()
  email: string;
}

@ObjectType()
export class AdminSignInResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => AdminUserResponse)
  admin: AdminUserResponse;
}

@ObjectType()
export class AdminSignUpResponse {
  @Field()
  message: string;

  @Field()
  success: boolean;

  @Field(() => AdminUserResponse)
  admin: AdminUserResponse;
}