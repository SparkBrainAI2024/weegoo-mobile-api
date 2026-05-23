import { Module } from '@nestjs/common';
import { IssuePersistenceModule } from './issue-persistence.module';
import { IssueService } from './issue.service';
import { UsersIssueResolver } from './resolver/users-issue.resolver';
import { RidePersistentModule } from '../../rides/src';


@Module({
  imports: [
    IssuePersistenceModule,
    RidePersistentModule, // needed for ride ownership check in service
  ],
  providers: [IssueService, UsersIssueResolver],
  exports: [IssueService, UsersIssueResolver],
})
export class IssueModule {}