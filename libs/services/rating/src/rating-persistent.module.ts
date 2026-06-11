import { Rating, RatingSchema, RatingRepository, User, UserSchema, UserDetails, UserDetailsSchema } from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Rating.name, schema: RatingSchema },
            { name: User.name, schema: UserSchema },
            { name: UserDetails.name, schema: UserDetailsSchema },
        ]),
    ],
    providers: [
        RatingRepository,
    ],
    exports: [
        RatingRepository,
        MongooseModule,
    ],
})
export class RatingPersistentModule {}