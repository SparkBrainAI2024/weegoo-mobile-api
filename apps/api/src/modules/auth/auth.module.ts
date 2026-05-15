import { Module } from "@nestjs/common";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AuthResolver } from "@libs/services/auth";
import { roles } from "@libs/data-access"; // Import roles enum

@Module({
  imports: [
    UserAuthModule.forRoot({ defaultRole: roles.USER }), // Specify USER role for the API app
  ],
  providers: [
   AuthResolver
  ]
})
export class AuthModule {}
