import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ProvinceEnum } from '../../enums/user.enum';
import { GeoLocationInput } from './geo-location.input';

@InputType()
export class RideLocationInput extends GeoLocationInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  address: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  city: string;

  @Field(() => ProvinceEnum)
  @IsNotEmpty()
  @IsEnum(ProvinceEnum)
  province: ProvinceEnum;

  @Field()
  @IsNotEmpty()
  @IsString()
  district: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  fullAddress: string;
}