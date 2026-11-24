import { Field, InputType, ObjectType } from "@nestjs/graphql";
import { IsNumber, IsOptional, IsString } from "class-validator";

@InputType()
export class InvoiceCreateInput {
  @Field()
  @IsNumber()
  fromAmount: number;

  @Field()
  @IsNumber()
  toAmount: number;

  @Field()
  @IsString()
  commissionCutOff: string;

  @Field()
  @IsString()
  commissionLocation: string;

  @Field()
  @IsString()
  fromLocation: string;

  @Field()
  @IsString()
  toLocation: string;

  @Field()
  @IsString()
  userEmail: string;
}

@ObjectType()
export class InvoiceCreateResponse {
  @Field()
  downloadLink: string;

  @Field()
  invoiceId: string;
}