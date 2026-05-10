import { Module } from "@nestjs/common";
import { UserServiceModule } from "@libs/services/user/user.module";
import { UserResolver } from "./resolver/user.resolver";
import { EnvService } from "@libs/common/config/env.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { UserDetailsResolver } from "./resolver/user.details.resolver";

@Module({
    imports: [
        UserPersistenceModule,
        UserServiceModule 
    ],
    providers: [
        UserResolver,
        UserDetailsResolver,
        EnvService,
    ]
})
export class UserModule { }
