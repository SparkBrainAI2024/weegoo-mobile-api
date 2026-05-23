import { Module } from '@nestjs/common';
import { IssuePersistenceModule } from '../user/src/issue-persistence.module';
import { IssueService } from './issue.service';
import { IssueResolver } from './resolver/users-issue.resolver';
import { RidePersistentModule } from '../rides/src';


@Module({
  imports: [
    IssuePersistenceModule,
    RidePersistentModule, // needed for ride ownership check in service
  ],
  providers: [IssueService, IssueResolver],
  exports: [IssueService, IssueResolver],
})
export class IssueModule {}