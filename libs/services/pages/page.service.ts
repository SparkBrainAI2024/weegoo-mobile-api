import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import {  PageStatus } from '@libs/data-access/enums/page.enum';
import { CreatePageInput } from '@libs/data-access/dtos/input/create-page.input';
import { PageRepository } from '@libs/data-access/repositories/page.repository';
import { PaginationInputOnly } from '@libs/data-access';
import { PageListWithPaginationResponse } from '@libs/data-access/dtos/response/page-list-with-pagination.response';
import { UpdatePageInput } from '@libs/data-access/dtos/input/update.-page.input';
import { Page } from '@libs/data-access/entities/page.entity';
import { toMongoId } from '@libs/common';


@Injectable()
export class PageService {
  constructor(private readonly pageRepository: PageRepository) {}

  async create(input: CreatePageInput): Promise<Page> {
    const slug = this.generateSlug(input.title);

    const existing = await this.pageRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException('A page with a similar title already exists');
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
      throw new NotFoundException('Page not found');
    }
    return page.toObject() as Page;
  }

  async findBySlug(slug: string): Promise<Page> {
    const page = await this.pageRepository.findBySlug(slug);
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page.toObject() as Page;
  }

  async findAll(filter: PaginationInputOnly): Promise<PageListWithPaginationResponse> {
   return this.pageRepository.findAll(filter)
  }

  async update(id: string, input: UpdatePageInput): Promise<Page> {
    const existing = await this.pageRepository.findById(toMongoId(id));
    if (!existing) {
      throw new NotFoundException('Page not found');
    }

    const updateData: Partial<Page> = { ...input };

    if (input.title && input.title !== existing.title) {
      const slug = this.generateSlug(input.title);

      const slugConflict = await this.pageRepository.findBySlug(slug);
      if (slugConflict && slugConflict._id.toString() !== id) {
        throw new ConflictException('A page with a similar title already exists');
      }

      updateData.slug = slug;
    }

    const updated = await this.pageRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException('Page not found');
    }

    return updated.toObject() as Page;
  }

  async publish(id: string): Promise<Page> {
    const existing = await this.pageRepository.findById(toMongoId(id));
    if (!existing) {
      throw new NotFoundException('Page not found');
    }

    if (existing.status === PageStatus.PUBLISHED) {
      throw new BadRequestException('Page is already published');
    }

    const updated = await this.pageRepository.updateStatus(id, PageStatus.PUBLISHED, new Date());
    if (!updated) {
      throw new NotFoundException('Page not found');
    }

    return updated.toObject() as Page;
  }

  async unpublish(id: string): Promise<Page> {
    const existing = await this.pageRepository.findById(toMongoId(id));
    if (!existing) {
      throw new NotFoundException('Page not found');
    }

    if (existing.status === PageStatus.DRAFT) {
      throw new BadRequestException('Page is already in draft');
    }

    const updated = await this.pageRepository.updateStatus(id, PageStatus.DRAFT, null);
    if (!updated) {
      throw new NotFoundException('Page not found');
    }

    return updated.toObject() as Page;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.pageRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException('Page not found');
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