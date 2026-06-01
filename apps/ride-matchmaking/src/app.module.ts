import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { envConfiguration } from '@libs/common';
import { AblyModule } from '@libs/services/ably';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/ride-matchmaking/.env',
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
      plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
    }),
    AblyModule,
    MatchmakingModule,
  ],
})
export class RideMatchmakingModule {}