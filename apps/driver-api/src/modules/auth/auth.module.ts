import { Module } from "@nestjs/common";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AuthResolver } from "@libs/services/auth";
import { roles } from "@libs/data-access";

@Module({
  imports: [
    UserAuthModule.forRoot({ defaultRole: roles.RIDER }),
  ],
  providers: [
   AuthResolver
  ]
})
export class AuthModule {}
