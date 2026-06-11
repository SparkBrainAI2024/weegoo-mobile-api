import { PaginationInputOnly } from "@libs/data-access";
import { CreatePageInput } from "@libs/data-access/dtos/input/create-page.input";
import { UpdatePageInput } from "@libs/data-access/dtos/input/update.-page.input";
import { PageListWithPaginationResponse } from "@libs/data-access/dtos/response/page-list-with-pagination.response";
import { Page } from "@libs/data-access/entities/page.entity";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { PageService } from "@libs/services/pages/page.service";
import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

// admin resolver - admin API
@UseGuards(AdminAuthGuard)
@Resolver(() => Page)
export class AdminPageResolver {
  constructor(private readonly pageService: PageService) {}

  @Query(() => Page, { name: 'page' })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Page> {
    return this.pageService.findById(id);
  }

  @Query(() => PageListWithPaginationResponse, { name: 'pages' })
  async findAll(@Args('paginationInput') paginationInput: PaginationInputOnly): Promise<PageListWithPaginationResponse> {
    return this.pageService.findAll(paginationInput);
  }

  @Mutation(() => Page)
  async createPage(@Args('input') input: CreatePageInput): Promise<Page> {
    return this.pageService.create(input);
  }

  @Mutation(() => Page)
  async updatePage(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdatePageInput): Promise<Page> {
    return this.pageService.update(id, input);
  }

  @Mutation(() => Page)
  async publishPage(@Args('id', { type: () => ID }) id: string): Promise<Page> {
    return this.pageService.publish(id);
  }

  @Mutation(() => Page)
  async unpublishPage(@Args('id', { type: () => ID }) id: string): Promise<Page> {
    return this.pageService.unpublish(id);
  }

  @Mutation(() => Boolean)
  async removePage(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.pageService.remove(id);
  }
}