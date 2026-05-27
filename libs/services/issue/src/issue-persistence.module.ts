import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Issue, IssueSchema } from '@libs/data-access/entities/issue.entity';
import { IssueRepository } from '@libs/data-access/repositories/issue.repository';
import { IssueCategory, IssueCategorySchema } from '@libs/data-access/entities/issue-category.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
       { name: IssueCategory.name, schema: IssueCategorySchema },
    ]),
  ],
  providers: [IssueRepository],
  exports: [IssueRepository],
})
export class IssuePersistenceModule {}