import { InputType, Field, ID, Int } from "@nestjs/graphql";
import { IsMongoId, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

@InputType()
export class CreateRatingInput {
  @Field(() => Int, { description: "Rating value between 1 and 5" })
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @Field(() => ID, { description: "User ID being rated" })
  @IsMongoId()
  @IsNotEmpty()
  ratedTo: string;

  @Field(() => ID, { description: "Ride ID" })
  @IsMongoId()
  @IsNotEmpty()
  rideId: string;

  @Field(() => String, { nullable: true, description: "Optional rating remarks" })
  @IsOptional()
  @IsString()
  ratingRemarks?: string;

  @Field(() => ID, {
    nullable: true,
    description: "Optional reference to a Remark entity id to populate the remarks section",
  })
  @IsOptional()
  @IsMongoId()
  remarkId?: string;
}
