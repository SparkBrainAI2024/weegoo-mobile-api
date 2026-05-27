import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsString, Min } from 'class-validator';

import { GraphQLJSON } from 'graphql-scalars';

export enum SortBy {
  asc = 1,
  desc = -1,
}

export const DEFAULT_PAGINATION_INPUT: PaginationInput = {
  page: 0,
  limit: 5,
  searchText: undefined,
  orderBy: '_id',
  order: SortBy.asc,
  filter: undefined,
};

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 0 })
  @Min(0)
  page: number = 0;

  @Field(() => Int, { defaultValue: 5 })
  @Min(5)
  limit: number = 5;

  @Field(() => String, { nullable: true })
  @IsOptional()
  orderBy?: string;

  @Field(() => SortBy, { defaultValue: SortBy.desc })
  @IsOptional()
  order: SortBy = SortBy.desc;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  searchText?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  filter?: Record<string, any>;
}
@InputType()
export class PaginationInputOnly {
  @Field(() => Int, { defaultValue: 0 })
  @Min(0)
  page: number = 0;

  @Field(() => Int, { defaultValue: 5 })
  @Min(5)
  limit: number = 5;
}

// Register the OrderBy enum for GraphQL
registerEnumType(SortBy, {
  name: 'SortBy',
  description: 'Order by direction for pagination',
  valuesMap: {
    asc: {
      description: 'Ascending order',
    },
    desc: {
      description: 'Descending order',
    },
  },
});
