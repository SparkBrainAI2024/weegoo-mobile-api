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
import { AblyModule } from "@libs/services/ably";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { RidesModule } from "./modules/rides/rides.module";
import { UserFavouritesModule } from "./modules/user-favourites/user-favourites.module";
import { IssueModule } from "./modules/issue/issue.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { PageModule } from "@admin-api/modules/page/page.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "apps/api/.env",
      load: [envConfiguration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DB_CONNECTION_URL'),
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: false,
      introspection: true,
      plugins: [
        // Install a landing page plugin based on NODE_ENV
        process.env.NODE_ENV === "production"
          ? ApolloServerPluginLandingPageProductionDefault({
              graphRef: "api@current",
              footer: false,
            })
          : ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      ],
    }),
    AblyModule,
    AuthModule,
    UserModule,
    RidesModule,
    IssueModule,
    UserFavouritesModule,
    NotificationModule,
    PageModule
  ],
  providers: [HealthResolver],
})
export class AppModule {}
