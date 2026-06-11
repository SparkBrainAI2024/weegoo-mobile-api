import { Injectable, HttpStatus } from '@nestjs/common';
import { PageStatus } from '@libs/data-access/enums/page.enum';
import { CreatePageInput } from '@libs/data-access/dtos/input/create-page.input';
import { PageRepository } from '@libs/data-access/repositories/page.repository';
import { PaginationInputOnly } from '@libs/data-access';
import { PageListWithPaginationResponse } from '@libs/data-access/dtos/response/page-list-with-pagination.response';
import { UpdatePageInput } from '@libs/data-access/dtos/input/update.-page.input';
import { Page } from '@libs/data-access/entities/page.entity';
import { ErrorException, toMongoId } from '@libs/common';


@Injectable()
export class PageService {
  constructor(private readonly pageRepository: PageRepository) {}

  async create(input: CreatePageInput): Promise<Page> {
    const slug = this.generateSlug(input.title);

    const existing = await this.pageRepository.findBySlug(slug);
    if (existing) {
       ErrorException(null, 'PAGE.ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    const created = await this.pageRepository.create({
      ...input,
      slug,
    });

    return created.toObject() as Page;
  }

  async findById(id: string): Promise<Page> {
    const page = await this.pageRepository.findById(toMongoId(id));
    if (!page) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return page.toObject() as Page;
  }

  async findBySlug(slug: string): Promise<Page> {
    const page = await this.pageRepository.findBySlug(slug);
    if (!page) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return page.toObject() as Page;
  }

  async findAll(filter: PaginationInputOnly): Promise<PageListWithPaginationResponse> {
    return this.pageRepository.findAll(filter);
  }

  async update(id: string, input: UpdatePageInput): Promise<Page> {
    const existing = await this.pageRepository.findById(toMongoId(id));
    if (!existing) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const updateData: Partial<Page> = { ...input };

    if (input.title && input.title !== existing.title) {
      const slug = this.generateSlug(input.title);

      const slugConflict = await this.pageRepository.findBySlug(slug);
      if (slugConflict && slugConflict._id.toString() !== id) {
         ErrorException(null, 'PAGE.ALREADY_EXISTS', HttpStatus.CONFLICT);
      }

      updateData.slug = slug;
    }

    const updated = await this.pageRepository.update(id, updateData);
    if (!updated) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return updated.toObject() as Page;
  }

  async publish(id: string): Promise<Page> {
    const existing = await this.pageRepository.findById(toMongoId(id));
    if (!existing) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (existing.status === PageStatus.PUBLISHED) {
       ErrorException(null, 'PAGE.ALREADY_PUBLISHED', HttpStatus.BAD_REQUEST);
    }

    const updated = await this.pageRepository.updateStatus(id, PageStatus.PUBLISHED, new Date());
    if (!updated) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return updated.toObject() as Page;
  }

  async unpublish(id: string): Promise<Page> {
    const existing = await this.pageRepository.findById(toMongoId(id));
    if (!existing) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (existing.status === PageStatus.DRAFT) {
       ErrorException(null, 'PAGE.ALREADY_DRAFT', HttpStatus.BAD_REQUEST);
    }

    const updated = await this.pageRepository.updateStatus(id, PageStatus.DRAFT, null);
    if (!updated) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return updated.toObject() as Page;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.pageRepository.delete(id);
    if (!deleted) {
       ErrorException(null, 'PAGE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return true;
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
}