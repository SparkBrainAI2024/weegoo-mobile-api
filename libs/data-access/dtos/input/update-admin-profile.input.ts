import { Field, ID, InputType, ObjectType } from "@nestjs/graphql";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

@InputType()
export class UpdateAdminProfileInput {
  @Field()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: "USER.MIN_FULL_NAME" })
  @MaxLength(30, { message: "USER.MAX_FULL_NAME" })
  fullName: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^\d{10}$/, { message: "ADMIN_USER.INVALID_PHONE" })
  phone?: string | null;
}

@InputType()
export class ChangeAdminPasswordInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @Field()
  @IsString()
  @MinLength(10, { message: "ADMIN_USER.PASSWORD_TOO_SHORT" })
  @MaxLength(72, { message: "ADMIN_USER.PASSWORD_TOO_LONG" }) // bcrypt silently ignores anything past 72 bytes
  newPassword: string;
}
