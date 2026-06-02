import { Module } from "@nestjs/common";
import { UserServiceModule } from "@libs/services/user/user.module";
import { UserResolver, UserDetailsResolver } from "@libs/services/user";
import { EnvService } from "@libs/common/config/env.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { S3Module } from "@libs/s3/s3.module";

@Module({
    imports: [
        UserPersistenceModule,
        UserServiceModule,
        S3Module,

    ],
    providers: [
        UserResolver,
        UserDetailsResolver,
        EnvService,
    ]
})
export class UserModule { }
