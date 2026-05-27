import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';

import { ErrorException, toMongoId } from '@libs/common';
import { Favourites, FavouritesDocument } from '../entities/favourites.entity';
import { PaginationInputOnly } from '../base/base.input';
import { FavouriteListWithPaginationResponse } from '../dtos/response/favourites-with-pagination.response';

@Injectable()
export class FavouritesRepository extends BaseRepository<FavouritesDocument> {
  constructor(@InjectModel(Favourites.name) private readonly _model: BaseModel<FavouritesDocument>) {
    super(_model);
  }
    async findByPassengerIdWithPagination(passengerId: string,paginationInput:PaginationInputOnly): Promise<FavouriteListWithPaginationResponse> {   
    try {
      const filter ={
        passengerId:toMongoId(passengerId),
        deleted:false
      }
      const result = await this.model.paginate( paginationInput,filter);
      return result;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
   async deleteFavourite(favouriteId: string, passengerId: string): Promise<FavouritesDocument | null> {  
    try {
      return await this.findOneAndUpdate(
        { _id: toMongoId(favouriteId), passengerId: toMongoId(passengerId) },
        { $set: { deleted: true, deletedAt: new Date() } },
        { new: true },
      );
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async createFavourite(favouriteData: Partial<FavouritesDocument>): Promise<FavouritesDocument> {
    try {
      const favourite = await this._model.create(favouriteData);
      return favourite;
    } catch (e) {
      ErrorException(e, "COMMON.INTERNAL_SERVER_ERROR", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
