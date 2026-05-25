import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';

@Resolver()
@UseGuards(AuthGuard)
export class UserTransactionResolver {
  constructor(
  ) {}
}