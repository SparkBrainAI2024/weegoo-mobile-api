import { Field, Float, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProvinceEnum } from '../../enums/user.enum';
import { GeoLocationInput } from './geo-location.input';

@InputType()
export class RideLocationInput {
  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field()
  @IsString()
  address: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  city?: string;

  @Field(() => ProvinceEnum, { nullable: true })
  @IsEnum(ProvinceEnum)
  @IsOptional()
  province?: ProvinceEnum;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  district?: string;

  @Field()
  @IsString()
  fullAddress: string;
}