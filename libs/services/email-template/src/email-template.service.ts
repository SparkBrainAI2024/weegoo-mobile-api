import { ErrorException, toMongoId } from "@libs/common";
import { EmailTemplateRepository } from "@libs/data-access/repositories/email-template.repository";
import { CreateEmailTemplateInput, UpdateEmailTemplateInput, EmailTemplateDocument, IPaginatedResult, PaginationInputOnly } from "@libs/data-access";
import { Injectable, HttpStatus } from "@nestjs/common";
import { Types } from "mongoose";

@Injectable()
export class EmailTemplateService {
  constructor(private readonly emailTemplateRepository: EmailTemplateRepository) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    try {
      const filter: any = { slug };
      if (excludeId) {
        filter._id = { $ne: new Types.ObjectId(excludeId) };
      }
      const existing = await this.emailTemplateRepository.findOne(filter);
      if (existing) {
        ErrorException(
          null,
          "EMAIL_TEMPLATE.SLUG_ALREADY_EXISTS",
          HttpStatus.CONFLICT,
        );
      }
    } catch (e) {
      ErrorException(e, "EMAIL_TEMPLATE.SLUG_ALREADY_EXISTS", HttpStatus.CONFLICT);
    }
  }

  async create(input: CreateEmailTemplateInput): Promise<EmailTemplateDocument> {
    try {
      const slug = this.generateSlug(input.title);
      await this.assertSlugUnique(slug);

      const emailTemplate = await this.emailTemplateRepository.create({
        title: input.title,
        slug,
        pageContent: input.pageContent,
        status: input.status || "DRAFT",
      });

      return emailTemplate;
    } catch (e) {
      ErrorException(e, "EMAIL_TEMPLATE.CREATE", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findById(id: string): Promise<EmailTemplateDocument> {
    try {
      const emailTemplate = await this.emailTemplateRepository.findById(toMongoId(id));
      if (!emailTemplate) {
        ErrorException(null, "EMAIL_TEMPLATE.NOT_FOUND", HttpStatus.NOT_FOUND);
      }
      return emailTemplate;
    } catch (e) {
      ErrorException(e, "EMAIL_TEMPLATE.NOT_FOUND", HttpStatus.NOT_FOUND);
    }
  }

  async findAll(paginationInput: PaginationInputOnly ): Promise<IPaginatedResult<EmailTemplateDocument>> {
    try {
    
      const { ...paginationOnly } = paginationInput;

      return this.emailTemplateRepository.paginate(
        paginationOnly,
        null,
        null,
      );
    } catch (e) {
      ErrorException(e, "EMAIL_TEMPLATE.FIND_ALL", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(id: string, input: UpdateEmailTemplateInput): Promise<EmailTemplateDocument> {
    try {
      const emailTemplate = await this.findById(id);

      const updatePayload: any = {};

      if (input.title && input.title !== emailTemplate.title) {
        updatePayload.title = input.title;
        updatePayload.slug = this.generateSlug(input.title);
        await this.assertSlugUnique(updatePayload.slug, id);
      }

      if (input.pageContent !== undefined) {
        updatePayload.pageContent = input.pageContent;
      }

      if (input.status !== undefined) {
        updatePayload.status = input.status;
      }

      return this.emailTemplateRepository.updateById(toMongoId(id), { $set: updatePayload });
    } catch (e) {
      ErrorException(e, "EMAIL_TEMPLATE.UPDATE", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.findById(id);
      await this.emailTemplateRepository.deleteById(toMongoId(id));
      return true;
    } catch (e) {
      ErrorException(e, "EMAIL_TEMPLATE.DELETE", HttpStatus.BAD_REQUEST);
    }
  }
}