import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from "@apollo/server/plugin/landingPage/default";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { join } from "path";
import { envConfiguration, HealthResolver } from "@libs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { SocialAuthModule } from "@libs/services/social-auth";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [envConfiguration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>("DB_CONNECTION_URL"),
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "apps/api/src/schema.gql"),
      playground: false,
      introspection: true,
      plugins: [
        // Install a landing page plugin based on NODE_ENV
        process.env.NODE_ENV === "production"
          ? ApolloServerPluginLandingPageProductionDefault({
              graphRef: "admin-api@current",
              footer: false,
            })
          : ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      ],
    }),
    SocialAuthModule.forRootAsync({
      useFactory: () => ({
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
          scope: [],
        },
        facebook: {
          appId: process.env.FACEBOOK_APP_ID || '',
          appSecret: process.env.FACEBOOK_APP_SECRET || '',
          redirectUri: process.env.FACEBOOK_REDIRECT_URI || '',
          scope: [],
        },
      }),
      inject: [],
    }),
    AuthModule,
    UserModule,
  ],
  providers: [HealthResolver],
})
export class AppModule {}
