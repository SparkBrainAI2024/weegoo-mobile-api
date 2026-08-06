import { Resolver, Query, Mutation, Args, ID } from "@nestjs/graphql";
import { EmailTemplateService } from "./email-template.service";
import {
  EmailTemplate,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  PaginationInput,
  PaginationInputOnly,
} from "@libs/data-access";
import { UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { EmailTemplateListWithPaginationResponse } from "./types/email-template-paginated.type";

@UseGuards(AdminAuthGuard)
@Resolver(() => EmailTemplate)
export class EmailTemplateResolver {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Mutation(() => EmailTemplate)
  async createEmailTemplate(
    @Args("input") input: CreateEmailTemplateInput,
  ): Promise<EmailTemplate> {
    return this.emailTemplateService.create(input);
  }

  @Query(() => EmailTemplate, { name: "emailTemplate" })
  async findOne(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<EmailTemplate> {
    return this.emailTemplateService.findById(id);
  }

  @Query(() => EmailTemplateListWithPaginationResponse, { name: "emailTemplates" })
  async findAll(
    @Args("paginationInput") paginationInput: PaginationInputOnly,
  ): Promise<EmailTemplateListWithPaginationResponse> {
    return this.emailTemplateService.findAll(paginationInput);
  }

  @Mutation(() => EmailTemplate)
  async updateEmailTemplate(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateEmailTemplateInput,
  ): Promise<EmailTemplate> {
    return this.emailTemplateService.update(id, input);
  }

  @Mutation(() => Boolean)
  async removeEmailTemplate(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.emailTemplateService.remove(id);
  }
}
