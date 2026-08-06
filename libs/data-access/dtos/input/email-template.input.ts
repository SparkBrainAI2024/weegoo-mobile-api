import { InputType, Field } from "@nestjs/graphql";
import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from "class-validator";

@InputType()
export class CreateEmailTemplateInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  pageContent: string;

  @Field({ defaultValue: "DRAFT" })
  @IsOptional()
  @IsEnum(["PUBLISHED", "DRAFT"])
  status?: "PUBLISHED" | "DRAFT";
}

@InputType()
export class UpdateEmailTemplateInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  pageContent?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(["PUBLISHED", "DRAFT"])
  status?: "PUBLISHED" | "DRAFT";
}

@InputType()
export class EmailTemplateFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}