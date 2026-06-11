import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel, BaseRepository, IPaginatedResult, PaginationInputOnly, SortBy } from '@libs/data-access';
import { Page, PageDocument } from '../entities/page.entity';

@Injectable()
export class PageRepository extends BaseRepository<PageDocument> {
    constructor(@InjectModel(Page.name) private readonly _model: BaseModel<PageDocument>) {

        super(_model)
    }

    async create(data: Partial<Page>): Promise<PageDocument> {
        const page = new this._model(data);
        return page.save();
    }

    async findPageById(id: string): Promise<PageDocument | null> {
        return this._model.findById(id).exec();
    }

    async findBySlug(slug: string): Promise<PageDocument | null> {
        return this._model.findOne({ slug }).exec();
    }

    async findAll(
        paginationInput: PaginationInputOnly,
    ): Promise<IPaginatedResult<PageDocument>> {

        return this.paginate({ ...paginationInput, order: SortBy.desc }, [], {});

    }

    async update(id: string, data: Partial<Page>): Promise<PageDocument | null> {
        return this._model.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async updateStatus(id: string, status: string, publishedAt?: Date | null): Promise<PageDocument | null> {
        return this._model
            .findByIdAndUpdate(id, { status, publishedAt }, { new: true })
            .exec();
    }

    async delete(id: string): Promise<PageDocument | null> {
        return this._model.findByIdAndDelete(id).exec();
    }
}