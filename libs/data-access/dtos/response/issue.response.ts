import { Field, ObjectType } from '@nestjs/graphql';
import { Issue } from '../../entities/issue.entity';
import { BasicResponse } from './basic.response';

@ObjectType()
export class CreateIssueResponse extends BasicResponse {
  @Field(() => Issue, { nullable: true })
  issue?: Issue;
}