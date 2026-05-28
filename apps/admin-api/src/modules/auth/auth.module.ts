import { Module } from "@nestjs/common";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AdminAuthResolver } from "./resolver/admin-auth.resolver";

@Module({
  imports: [
    UserAuthModule.forRoot(),
    
  ],
  providers: [
   AdminAuthResolver
  ]
})
export class AuthModule {}
