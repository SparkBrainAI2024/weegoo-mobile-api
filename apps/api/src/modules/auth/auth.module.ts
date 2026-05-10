import { Module } from "@nestjs/common";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AuthResolver } from "@libs/services/auth";

@Module({
  imports: [
    UserAuthModule.forRoot(),
  ],
  providers: [
   AuthResolver
  ]
})
export class AuthModule {}
