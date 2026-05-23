import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Issue } from '@libs/data-access/entities/issue.entity';

@ObjectType()
export class PaginatedIssues {
  @Field(() => [Issue])
  items: Issue[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}