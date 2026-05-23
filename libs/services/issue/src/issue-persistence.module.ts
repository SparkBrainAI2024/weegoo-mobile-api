import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from '@libs/data-access/entities/issue.entity';
import { IssueRepository } from '@libs/data-access/repositories/issue.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
    ]),
  ],
  providers: [IssueRepository],
  exports: [IssueRepository],
})
export class IssuePersistenceModule {}