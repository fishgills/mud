import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule } from './render/render.module';
import { WorldRefactoredModule } from './world/world-refactored.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    }),
    WorldRefactoredModule,
    RenderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
