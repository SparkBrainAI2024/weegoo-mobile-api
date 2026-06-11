import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CreatePageInput } from '@libs/data-access/dtos/input/create-page.input';

import { AdminAuthGuard } from '@libs/guards/auth.admin.guard';
import { PageService } from '../page.service';
import { Page } from '@libs/data-access/entities/page.entity';
import { PageListWithPaginationResponse } from '@libs/data-access/dtos/response/page-list-with-pagination.response';
import { PaginationInputOnly } from '@libs/data-access';
import { UpdatePageInput } from '@libs/data-access/dtos/input/update.-page.input';

@Resolver(() => Page)
export class PageResolver {
  constructor(private readonly pageService: PageService) {}

  @Query(() => Page, { name: 'page' })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Page> {
    return this.pageService.findById(id);
  }

  @Query(() => Page, { name: 'pageBySlug' })
  async findBySlug(@Args('slug') slug: string): Promise<Page> {
    return this.pageService.findBySlug(slug);
  }

  @Query(() => PageListWithPaginationResponse, { name: 'pages' })
  async findAll(
    @Args('paginationInput') paginationInput: PaginationInputOnly,
  ): Promise<PageListWithPaginationResponse> {
    return this.pageService.findAll(paginationInput);
  }




}