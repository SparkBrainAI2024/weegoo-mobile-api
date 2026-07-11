import { Rating, RatingSchema, RatingRepository, Remark, RemarkSchema, RemarkRepository, User, UserSchema, UserDetails, UserDetailsSchema } from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Rating.name, schema: RatingSchema },
            { name: Remark.name, schema: RemarkSchema },
            { name: User.name, schema: UserSchema },
            { name: UserDetails.name, schema: UserDetailsSchema },
        ]),
    ],
    providers: [
        RatingRepository,
        RemarkRepository,
    ],
    exports: [
        RatingRepository,
        RemarkRepository,
        MongooseModule,
    ],
})
export class RatingPersistentModule {}