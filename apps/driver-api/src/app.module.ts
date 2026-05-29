import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { envConfiguration, HealthResolver } from '@libs/common';
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { DriverDocumentModule } from './modules/driver-document/driver-document.module';
import { UploadCenterModule } from '@libs/services/upload-center/src';
import { RidesModule } from './modules/rides/rides.module';
import { IssueModule } from './modules/issue/issue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: 'apps/driver-api/.env', load: [envConfiguration] }),
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
        process.env.NODE_ENV === 'production'
          ? ApolloServerPluginLandingPageProductionDefault({
            graphRef: 'admin-api@current',
            footer: false,
          })
          : ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      ],
    }),
    AuthModule,
    UserModule,
    VehicleModule,
    CleanupModule,
    DriverDocumentModule,
    UploadCenterModule,
    RidesModule,
    IssueModule,
  ],
  providers: [HealthResolver],
})
export class AppModule { }
