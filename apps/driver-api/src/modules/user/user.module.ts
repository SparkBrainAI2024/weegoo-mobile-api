import { Module } from "@nestjs/common";
import { UserServiceModule } from "@libs/services/user/user.module";
import { UserResolver, UserDetailsResolver } from "@libs/services/user";
import { EnvService } from "@libs/common/config/env.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { DriverUserResolver } from "./resolver/driver-user.resolver";

@Module({
    imports: [
        UserPersistenceModule,
        UserServiceModule // ✅ use it properly
    ],
    providers: [
        UserResolver,
        UserDetailsResolver,
        EnvService,
        DriverUserResolver
    ]
})
export class UserModule { }
