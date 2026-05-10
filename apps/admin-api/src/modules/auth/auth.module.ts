import { Module } from "@nestjs/common";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AuthResolver } from "./resolver/auth.resolver";

@Module({
  imports: [
    UserAuthModule.forRoot(),
    
  ],
  providers: [
   AuthResolver
  ]
})
export class AuthModule {}
